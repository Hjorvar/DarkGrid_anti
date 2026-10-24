# DARKGRID — PHASE 10: Staðfesting Öryggisafrita og Gagnavernd (`PRODUCTION-BACKUP-VERIFICATION.md`)

**Dagsetning:** 24. október 2026  
**Verkhluti:** Phase 0.2 & Phase 1.2 — Highest-Priority Data Protection, WAL-Safe SQLite Backups & Live Firestore Verification  
**Staða:** **PASS**

---

## 1. Greining á staðbundnum SQLite gagnagrunnum og lifandi Firestore

Áður en nokkur Git-sameining, gagnagrunnsuppfærsla eða útgáfa fór fram voru bæði staðbundnir SQLite gagnagrunnar og lifandi Cloud Firestore (`darkgrid-rpg`) rannsökuð í einangruðu les-umhverfi:

1. **Staðbundinn `C:\Users\hih\Documents\antiDark\data\darkgrid.sqlite` (frá 23. okt 2026):**
   - Innihélt **9 notendareikninga** (`id=1` til `id=2138115538`), **1 lifandi hetju** (`Torgal`, Level 1 Ranger, `200 XP`, `59 GP`, `8/8 HP`, `tile_id=113`), **5 hluti (`item_instances`)**, **4 veiðisamninga (`hunting_contracts`)**, **1 bardaga (`encounters`)**, **6 bardagaviðburði (`combat_events`)** og **300 lotur (`user_sessions`)**.
2. **Staðbundið `C:\Users\hih\Documents\antiDark\db\backups\production-backup-latest.json` (frá 15. okt 2026):**
   - Innihélt sömu 9 notendur og hetjuna `Torgal` í `sqliteSnapshot` ásamt 8 skjölum í Firestore `users` og `usernames`.
3. **Lifandi Cloud Firestore (`darkgrid-rpg` — `server_*` töflur skoðaðar 24. okt 2026 kl. 11:15 UTC):**
   - Í ljós kom að lifandi Firestore (`server_users`, `server_characters`, `server_item_instances`, `server_hunting_contracts`) innihélt **nýrri gögn en staðbundni SQLite grunnurinn**, þar á meðal **10. notandann** sem var stofnaður í framleiðslu þann 24. október kl. 10:42 UTC:
     - **10 notendareikningar (`server_users`):** `haraldur`, `Micron`, `Vessel`, `gabrielorra`, `viggida`, `BiscuitLord`, `SkibidiToilet`, `Panchoman`, `hjorvar` og **`hjorvaringi`** (`id=2138115539`).
     - **2 lifandi hetjur (`server_characters`):**
       1. **`Torgal`** (`id=1`, `user_id=1`, `RANGER`, Level 1, `200 XP`, `59 GP`, `8/8 HP`, `is_alive=1`).
       2. **`magnus`** (`id=2`, `user_id=2138115539`, `RANGER`, Level 1, `0 XP`, `10 GP`, `8/8 HP`, `is_alive=1`).
     - **10 hlutir (`server_item_instances`)**, **7 veiðisamningar (`server_hunting_contracts`)**, **1 encounter**, **6 combat_events** og **300 user_sessions**.

---

## 2. WAL-meðvituð SQLite öryggisafrit, SHA-256 prófsummur og endurheimtuprófun

Öll staðbundin SQLite gögn voru afrituð með innbyggðri WAL-meðvitaðri `VACUUM INTO` aðferð SQLite (eftir `PRAGMA wal_checkpoint(PASSIVE)`) og prófuð með `PRAGMA integrity_check` í tímabundnum endurheimtugrunni:

| Afritsskrá | Stærð (Bytes) | SHA-256 Checksum | `integrity_check` | Staðfest innihald |
| :--- | :---: | :--- | :---: | :--- |
| `darkgrid-main-authoritative-2026-10-24T11-12-52-452Z.sqlite` | `700,416` | `2c159b0d2e7f38acf7872057d8b2eb912da01bbbf2d3c5b50d252dbf202fed40` | `ok` | 9 users, 1 character (`Torgal`), 5 items, 300 sessions |
| `action-lab-local-2026-10-24T11-12-52-452Z.sqlite` | `1,146,880` | `d32c2a3585cca32cd6735f2b2c7c5c4e63118f6e4c5ba43111f8603974af9167` | `ok` | 1 user, 10 characters, 46 items, 42 encounters |
| `action-lab-prev-backup-2026-10-24T11-12-52-452Z.sqlite` | `802,816` | `1250efcbda271dae641488cf7ebbaaa6a0450d23940362c834db5a342ef56802` | `ok` | 1 user, 9 characters, 39 items, 32 encounters |
| `production-backup-2026-10-15-verified.json` | `26,263` | `dfc168ce125bfd9a87127e998c2eded914e7198be611563b92f589595c682a9e` | `valid` | 9 SQLite users, 8 Firestore legacy users |
| `firestore-live-authoritative-2026-10-24T11-16-15-184Z.json` | Fullt Firestore afrit | `196bc9e0375717f83bff010c94bf69e7275504b0eef2a1cc7befac54eb2db92f` | `valid` | **10 `server_users`, 2 `server_characters` (`Torgal`, `magnus`), 10 items, 7 contracts** |
| `production-backup-latest.json` (Samstillt v2.1.0-blaze) | Fullt samstillt afrit | `7a616b27c0492d822c86cafa2398d3174135cafaf0fd8b50e7a1e724ec9fb149` | `valid` | **10 users, 2 characters á Oakhaven `tile_id=1429`, 10 items, 7 contracts, 98 discovered tiles** |

---

## 3. Fail-Safe vörn gegn tómum afritum (`scripts/backup_database.js`)

Til að koma í veg fyrir að tómur worktree-gagnagrunnur eða útrunnið OAuth token geti nokkurn tíma yfirskrifað `production-backup-latest.json` með 0 notendum voru eftirfarandi varnir innleiddar í [`scripts/backup_database.js`](../../scripts/backup_database.js):
1. **Bæði Legacy og `server_*` töflur afritaðar:** `fetchFirestoreCollections` sækir nú öll 8 legacy söfnin OG öll 16 `server_*` söfnin (`server_users`, `server_characters`, o.s.frv.).
2. **Ströng HTTP 401/403 villuvörn:** Ef Firestore REST API skilar `401`, `403`, netvillu eða annarri villu kastar `fetchFirestoreCollections` tafarlaust villu (`FIRESTORE_UNAUTHENTICATED` / `FIRESTORE_PERMISSION_DENIED`) í stað þess að skila tómum fylkjum.
3. **Tóm-yfirskriftarvörn (`EMPTY_BACKUP_OVERWRITE_BLOCKED`):** Áður en `production-backup-latest.json` er uppfærð athugar `runBackup()` hvort eldra afrit á diski innihaldi notendur (`existingCounts.maxUsers > 0`). Ef nýja afritið eða staðbundinn SQLite grunnur er með `0` notendur er skrifunum hafnað samstundis.
4. **Atomic Write & Endurlestrarprófun:** Afrit er fyrst skrifað í `.tmp` skrá, lesið til baka, JSON og SHA-256 prófsumma sannreynd með `verifySnapshotIntegrity()`, og aðeins þá fært yfir á `production-backup-latest.json` með `fs.renameSync`.
