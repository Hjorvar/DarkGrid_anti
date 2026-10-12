---
name: darkgrid-rules
description: Essential rules, architecture principles, and constraints for Darkgrid RPG development.
---

# Darkgrid — Agent Rules & Guidelines

Þetta skjal inniheldur mikilvægustu reglur og verklag fyrir gervigreindarforritara (AI coding agents) sem vinna í Darkgrid verkefninu.

## 1. Meginreglur og hugmyndafræði (Core Philosophy)
- **Textamiðað dökkt fantasíu-RPG:** Leikurinn leggur áherslu á andrúmsloft, dökka textalýsingu, d20 vélfræði (Pathfinder 1e/3.5 innblásið) og permadeath.
- **Server-Side Truth:** Allar leikreglur, hreyfingar, encounters, teningaköst og staðfestingar verða að eiga sér stað á servernum. Frontend (EJS/HTML/CSS) er eingöngu birting og notendaviðmót.
- **Sýnilegur framgangur (Visible Progress):** Allar breytingar eiga að vera sýnilegar og prófanlegar í vafra sem fyrst. Ekki fresta sýnilegum eiginleikum til að byggja of flókna ósýnilega undirkerfi.

## 2. Staða verkefnis (Project Status)
- **Phase 1 (Lokið & staðfest):**
  - Notendaumsjón (Register/Login með bcrypt og express-session).
  - Hetjustofnun fyrir Fighter, Ranger og Cleric með löglegri stigaúthlutun (71 stig, max 18, min base-2).
  - 15x15 dökkt heimskort með 225 reitum (bær, skógur, frumskógur, mýri, fjöll, vötn).
  - 5x5 minimap með sjónlínuhetju og N/S/A/V hreyfistýringu.
  - Gaussian normalvigtuð skrímslavalvél með landslagsíun (terrain habitat matching).
  - 38 Pathfinder 1e skrímsli með 9 enskum lýsingum hvert og 2D listaverkum.
  - Encounter-læsing sem lifir af síðuendurhleðslu (refresh persistence) og leysist með Ignore/Investigate.
- **Phase 2 & 3 (Bardagakerfi, Permadeath & Persistent Monsters):**
  - **Hönnun og framkvæmdaáætlun tilbúin í [`docs/combat-system-plan.md`](../../docs/combat-system-plan.md).**
  - **Ekki hefja forritun á bardagakerfinu fyrr en notandi hefur samþykkt áætlunina.**

## 3. Bardagareglur og persistent monsters (Lykilreglur)
- **Aðgerðir:** Spilarinn hefur nákvæmlega þrjár aðgerðir: `Attack`, `Drink Potion`, `Flee`.
- **Upplýsingaleynd:** Spilarinn sér eigið HP og potions, en aldrei tölulegt HP, AC, attack bonus eða teningaköst óvinarins. Textalýsingar birtast þegar heilsufarsflokkur skrímslis lækkar (`5_health_100` til `9_dead`).
- **Permadeath:** HP = 0 veldur endanlegum dauða hetju.
- **Persistent Monsters:** Aðeins skrímsli sem drepa spilara festast á reitnum. Fá +10% max HP boost einu sinni (`Math.ceil(base_hp * 1.10)`), halda 50% gulls og 50% hluta (hámark 20 hluti) og byrja nýja bardaga með fullt HP í v1.

## 4. Gagnagrunnur og gögn (Database Guidelines)
- Gagnagrunnur er SQLite (`better-sqlite3`) staðsettur í `data/darkgrid.sqlite`.
- Allar breytingar á skema skulu fara fram í gegnum migrations í `db/migrations/`.
- Frumgögn og kortaskilgreiningar eru í `db/seeds/`.
- WAL-stilling (Write-Ahead Logging) og foreign keys eru virkjaðar sjálfgefið.
- Eignatilfærslur, sigur og dauði skulu ávallt fara fram í atómum færslum (`withTransaction`).

## 5. Prófanir og gæðaeftirlit (Testing Requirements)
- Allar nýjar reglur eða lagfæringar í `src/domain/` skulu studdar af sjálfvirkum prófum í `tests/`.
- Keyrðu alltaf `npm test` áður en verkefni er talið lokið til að tryggja að öll próf standist.

## 6. Tengd skjöl og heimildir (Document Index)
- **Aðalskjal bardagakerfis:** [`docs/combat-system-plan.md`](../../docs/combat-system-plan.md)
- **Heildarlýsing leiksins:** [`.agents/specs/DARKGRID_GAME_SPEC.md`](../specs/DARKGRID_GAME_SPEC.md)
- **Áfangaskipting og verkáætlun:** [`.agents/specs/DARKGRID_IMPLEMENTATION_PLAN.md`](../specs/DARKGRID_IMPLEMENTATION_PLAN.md)
- **Opnar ákvarðanir og næstu skref:** [`.agents/specs/OPEN_DECISIONS.md`](../specs/OPEN_DECISIONS.md)
- **Tungumálastefna (English Only):** [`.agents/rules/language.md`](language.md)
- **Leynd og afhjúpun skrímsla:** [`.agents/rules/encounter-design.md`](encounter-design.md) og [`docs/encounter-design.md`](../../docs/encounter-design.md)
- **Skrímslamyndir og stíll:** [`.agents/rules/monster-art.md`](monster-art.md) og [`docs/monster-art-style.md`](../../docs/monster-art-style.md)
