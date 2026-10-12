# DARKGRID — Textamiðaður Dark Fantasy RPG (Phase 1)

Darkgrid er vefleikur í dark fantasy stíl sem sameinar textamiðaða könnun, d20 bardagahefð og samnýttan, viðvarandi heim með varanlegum dauða (*permadeath*).

Þessi útgáfa inniheldur **Phase 1: Fyrstu sýnilegu og keyranlegu útgáfuna** samkvæmt `.agents/specs/AGENT_START_HERE.md` og `.agents/specs/DARKGRID_IMPLEMENTATION_PLAN.md`. Fyrirmæli fyrir agents eru í `AGENTS.md`.

---

## ⚡ Fljótleg ræsing (Quick Start)

### 1. Kröfur
- **Node.js**: v20+ eða v22+ (verkefnið nýtir innbyggða `node:sqlite` með WAL og foreign keys).
- **Vafri**: Hvaða nútímalegur vafri sem er (Chrome, Firefox, Safari, Edge).

### 2. Uppsetning og prófanir
```bash
# Sækja dependencies
npm install

# Búa til gagnagrunn og keyra migrations og seed (15x15 kort og skrímsli)
npm run db:setup

# Keyra sjálfvirk próf
npm test
```

### 3. Ræsa leikinn
```bash
npm start
# eða
npm run dev
```

Opnaðu síðan vafra á: **[http://localhost:3000](http://localhost:3000)**

---

## 🎮 Hvað er virkt í Phase 1

1. **Aðgangsstjórnun og auðkenning (Auth):**
   - Nýskráning (`/register`) og innskráning (`/login`) með öruggu bcrypt lykilorðahashi og session.
   - Ef notandi á enga lifandi hetju er hann sjálfkrafa sendur í Character Creation.
   - Ef notandi á lifandi hetju fer hann beint inn á leikskjáinn (`/game`).

2. **Sköpun hetju (Character Creation):**
   - **Þrír classar:** Fighter, Ranger og Cleric með nákvæmum grunn-stats samkvæmt hönnun.
   - **Lögleg punktadreifing:** 3 aukapunktar, heimild til að lækka hvert stat um allt að 2 (niður í base - 2) og hækka annað (hámark 18). Heildarstig verða að vera nákvæmlega 71.
   - **Regla um eina lifandi hetju:** Bæði backend og SQLite (`UNIQUE INDEX ON characters(user_id) WHERE is_alive = 1`) tryggja að hver notandi getur aðeins átt eina lifandi hetju í einu.
   - Gagnvirkur stat-reiknir á forsíðu sem uppfærir stig og d20 modifiers í rauntíma.

3. **Kort og ferðalög (World & Movement):**
   - **15×15 viðvarandi seed-kort (225 reitir):** Borgin *Eikahöfn (Oakhaven)* er öruggur byrjunarreitur í miðju, umkringd Dimmiviði (Forest), Rotmýri (Swamp), Eiturfrumskógi (Jungle), Grænuhlíðum (Plains), Hrafnaklettum (Hills), Svartá (River) og Gamla steinboganum (Bridge).
   - **Aðalskjár:** Stórt heiti svæðis, landslagsmerki, nákvæm textalýsing á reitnum og hnit.
   - **5×5 Minimap:** Sýnir nærliggjandi reiti með litum og táknum (`@` fyrir leikmann, `🏰`, `🌲`, `🌫️`, `🌴`, `🌾`).
   - **Ferðastjórn:** Áttirnar Norður, Suður, Austur og Vestur. Kerfið hindrar för út fyrir heimskort eða inn á ófæra reiti (hvassa fjallstinda eða djúpvötn).
   - Staðsetning vistast á leikjaþjóninum; endurhleðsla á síðu breytir engu.

4. **Random encounters og skrímslaval (Encounter Engine):**
   - **Kast aðeins við ferðaskref:** Page refresh endurkastar aldrei; virkur bardagi/encounter helst virkur yfir endurhleðslur.
   - **Örugg svæði:** Borgin Eikahöfn kastar aldrei fyrir skrímslum.
   - **Stillanlegar forsendur:** 25% líkur á encounter á óöruggum reit, sigma = 1.5.
   - **Vörpun landslags:** Backend varpar sjálfkrafa `FOREST → F`, `JUNGLE → J`, `SWAMP → S` yfir í habitat skrímslanna.
   - **Normaldreifing:** Líklegast er að mæta skrímsli á sama leveli og hetjan (`H`); líkur falla samhverft með fjarlægð frá því stigi.
   - **Níu lýsingar & Ranger-sérstaða:**
     - Assassin Vine er útfært með öllum 9 sérsniðnum lýsingum höfundar úr `seed_assassin_vine.sql`.
     - Ranger fær sérsniðna, upplýsandi lýsingu (`2_ranger_distant` í stað `1_distant`).
     - Engar tölur um HP eða skaða óvina birtast.
   - **Aðgerðir:**
     - **Investigate:** Birtir nánari lýsingu (`3_close` eða `4_ranger_close` fyrir Ranger) og Phase 1 staðgengil fyrir bardaga.
     - **Ignore:** Sniðgengur skrímslið og aflæsir hreyfingu.
     - Meðan encounter er óleyst er ferðastjórn læst.

---

## 📁 Uppbygging verkefnis

```text
├── src/
│   ├── config/              # Central config (port, session, sigma, encounter chance, class bases)
│   ├── db/                  # SQLite connection (WAL, foreign keys), migration & seed runner
│   ├── domain/
│   │   ├── auth/            # Bcrypt hashing og user authentication
│   │   ├── character/       # Stat validation, d20 modifiers og character lifecycle
│   │   ├── world/           # Map lookup, 5x5 minimap og navigation rules
│   │   └── encounters/      # Gaussian normal-weighting, terrain habitat filter, 9 descriptions
│   ├── middleware/          # Auth requireAuth og DB attachment
│   ├── routes/              # Express routes (auth, character, game)
│   ├── views/               # EJS templates (layout, login, register, create-character, game)
│   ├── app.js               # Express application configuration
│   └── server.js            # Server entrypoint
├── public/
│   ├── css/style.css        # Dark fantasy útlit, responsive hönnun og minimap stílar
│   └── js/                  # Client-side helper fyrir character creation
├── db/
│   ├── migrations/          # 001_initial_schema.sql (fullt SQLite vinnuskema)
│   └── seeds/               # 001_seed_world.sql (225 reitir), 002_seed_monsters.sql
├── tests/                   # Sjálfvirk próf (stats, lifecycle, movement, encounters, HTTP flow)
├── scripts/                 # Hjálparskriftur (setup_db.js, generate_world_seed.js)
├── AGENTS.md                # Aðalinngangur og leiðbeiningar fyrir AI coding agents
├── .agents/                 # Sérstök mappa fyrir reglur, hönnunarskjöl og forskriftir
│   ├── rules/               # Sjálfvirkt greindar verklagsreglur (darkgrid_rules.md)
│   ├── specs/               # Leikjahönnun (DARKGRID_GAME_SPEC.md, o.fl.)
│   └── reference/           # Upprunaleg drög og SQL dæmi
```

---

## 🧪 Prófanir

Keyrðu prófunarpakkann með:
```bash
npm test
```

Prófin ná yfir:
1. **Stat Validation:** Modifiers `floor((score-10)/2)`, prófun á löglegum og ólöglegum gildum, lækkun um 2, hámarki 18 og 71 heildarstigum.
2. **Character Lifecycle:** Ein lifandi hetja á hvern reikning, hindrun á samtímahetjum, stofnun nýrrar hetju eftir dauða og varðveisla sögulegra gagna.
3. **World Movement:** Hreyfing í N/S/A/V, stöðvun á jaðri heims, ófærir reitir (fjöll/vötn), 5×5 minimap útreikningar.
4. **Encounter Engine:** Gaussian normalvigtun, tölfræðileg prófun á vali miðað við hetjulevel, habitat filter (`F/J/S`), örugg svæði, 9 lýsingar fyrir Assassin Vine, Ranger bónusar, læsing hreyfingar og endurhleðsluöryggi (refresh persistence).
5. **End-to-End HTTP Integration:** Nýskráning → Stofnun hetju → Birting leikskjás → Ferðalag til norðurs.
