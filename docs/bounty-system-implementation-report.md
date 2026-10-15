# Darkgrid — The Watcher's Board & Bounty Hunting System Implementation Report

## 1. Yfirlit yfir innleiðingu (Executive Summary)

**The Watcher's Board** hefur verið innleitt í Oakhaven sem fyrsta heildstæða gameplay-hringrás (gameplay loop) Darkgrid:

1. **Heimsókn í Oakhaven:** Spilari opnar **🎯 The Watcher's Board** í Oakhaven.
2. **Tvö aðskilin kerfi í sama viðmóti:**
   - **Kerfi A — Hunting Contracts (Persónubundin veiðiverkefni):** Borgin býður allt að 3 veiðiverkefni í einu. Spilari getur aðeins haft **eitt virkt verkefni** (`ACTIVE` eða `READY_TO_CLAIM`) í einu.
   - **Kerfi B — Threats in the Wilderness (Viðvaranir um Persistent Monsters):** Sýnir óljósar vísbendingar um raunveruleg persistent monsters (`monster_instances`) sem hafa fellt hetjur — eingöngu átt frá Oakhaven (t.d. `North`, `Southeast`), fjölda fallinna hetja (`kill_count`) og drungalega viðvörun, án þess að ljóstra upp tegund skrímslis, nafni, nákvæmum `(x, y)` hnitum, tölfræði eða stolnum hlutum.
3. **Leit á svæði (Region Hunting):** Hvert Hunting Contract vísar á raunverulegt svæði (`region_name`, t.d. `Verdant Plains`, `Mirkwood Forest`, `Raven Crags`, `Rotting Fen`, `Venomous Jungle`, `Windblown Heath`), ekki stakan reit og ekki bara almenna landslagstegund (`terrain`).
4. **Encounter líkur og leynd:** Inni á virku veiðisvæði hækka encounter-líkur í **40%** (í stað 25%) og ef encounter verður eru **75% líkur** á að það sé hið nafngreinda skotmark. Á fyrsta encounter-stigi (`DISCOVERED`) helst skrímslið og sérnafn þess óþekkt; þegar bardagi hefst (`IN_COMBAT`) birtist sérnafnið (t.d. `Gorgan the One-Eyed`), blóðrauður rammi (`.bounty-art-frame`) utan um myndina og eiginleikamerki.
5. **Heimkoma og útborgun í Oakhaven:** Sigur á skotmarkinu breytir samningnum í `READY_TO_CLAIM` án þess að borga verðlaunaféð á vígvellinum. Þegar hetjan kemst lifandi aftur til Oakhaven greiðast gullverðlaunin sjálfkrafa (`COMPLETED`) með tilkynningaborða.

---

## 2. Gagnagrunnsbreytingar (`db/migrations/012_watcher_board_bounties.sql`)

Bætt var við nýrri töflu `hunting_contracts` og tengingu úr `encounters`:

- **`hunting_contracts`:**
  - `id` (`INTEGER PRIMARY KEY AUTOINCREMENT`)
  - `character_id` (`INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE`)
  - `base_monster_id` (`INTEGER NOT NULL REFERENCES monsters(id) ON DELETE CASCADE`)
  - `custom_name` (`TEXT NOT NULL`) — Einstakt nafn skotmarks (t.d. `Gorgan the One-Eyed`), falið á töflunni þar til skrímslið er auðkennt í Stage 2.
  - `title`, `description` (`TEXT NOT NULL`) — Enskur titill og lýsing á veiðiverkefninu.
  - `region_name`, `target_terrain`, `threat_label` (`TEXT NOT NULL`)
  - `boost_type` (`CHECK(boost_type IN ('TOUGH', 'AGGRESSIVE', 'BRUTAL'))`)
  - `boost_label` (`TEXT NOT NULL`)
  - `boosted_max_hp`, `attack_bonus_mod`, `damage_bonus_mod` (`INTEGER NOT NULL`)
  - `reward_gold` (`INTEGER NOT NULL CHECK(reward_gold > 0)`)
  - `status` (`CHECK(status IN ('AVAILABLE', 'ACTIVE', 'READY_TO_CLAIM', 'COMPLETED', 'ABANDONED', 'FAILED'))`)
  - `created_at_level`, `created_at_encounters` (`INTEGER NOT NULL`) — Notað til að koma í veg fyrir ókeypis rerolls í Oakhaven.
  - `created_at`, `completed_at`, `claimed_at` (`TEXT`)
- **Partial Unique Index (`idx_hunting_contracts_one_active_per_char`):**
  - `CREATE UNIQUE INDEX idx_hunting_contracts_one_active_per_char ON hunting_contracts(character_id) WHERE status IN ('ACTIVE', 'READY_TO_CLAIM');`
  - Tryggir á gagnagrunnsstigi að engin persóna geti nokkurn tímann haft fleiri en eitt virkt eða ógreitt verkefni í einu.
- **`encounters.bounty_contract_id`:**
  - `ALTER TABLE encounters ADD COLUMN bounty_contract_id INTEGER REFERENCES hunting_contracts(id);`
  - Tryggir að venjulegt skrímsli af sömu tegund á sama svæði klári aldrei samninginn fyrir mistök.

---

## 3. Hvernig svæði (Regions) og Encounter líkur virka

- **Region vs. Terrain (`src/domain/bounties/board.js` & `src/domain/encounters/engine.js`):**
  - `getReachableWildernessRegions(db)` notar BFS-leit frá Oakhaven til að finna öll fær óbyggðasvæði (`map_tiles.name`) og reiknar fjarlægð (`minDist`, `maxDist`) og átt frá Oakhaven.
  - Undir-kennileiti innan stærri svæða (eins og `Heart of the Mirkwood` innan `Mirkwood Forest` og `Deadman's Mire` innan `Rotting Fen`) eru normalíseruð í sitt móðursvæði (`resolveTileRegionName`) svo samningurinn gildi á öllu svæðinu.
- **Encounter-líkur í `checkTileEncounter`:**
  1. **Forgangur 1 — Global Persistent Monster (`monster_instances`):** Ef virkt persistent monster er á reitnum hefur það áfram 100% forgang.
  2. **Forgangur 2 — Active Bounty Region:** Ef spilarinn er með `ACTIVE` samning á núverandi `region_name` eru encounter-líkur í gildu skrefi **40%** (kemur í stað 25%, ekki aukakast). Ef encounter verður eru **75% líkur** á að Named Bounty skotmarkið birtist (með CR/level öryggisreglum) og 25% líkur á venjulegu skrímsli.
  3. **Utan Bounty Region / Aðrar persónur:** Venjulegar 25% líkur og 0% líkur á að hitta Named Bounty skotmark.

---

## 4. Nafngjöf, Monster Boosts og Combat Balance

- **Deterministic Nafngjöf (`generateBountyMonsterName`):**
  - Byggir á tegundaflokkun skrímslis (`goblinoid`, `undead`, `beast`, `vermin`, `plant`, `default`) og drungalegum viðurnefnum (`the One-Eyed`, `the Cruel`, `the Scarred`, `the Vicious`, `the Hunter`, `the Merciless`, o.fl.). Nafnið er valið einu sinni við stofnun samnings og vistað í `hunting_contracts.custom_name`.
- **Einn styrkleikabónus (`BOUNTY_BOOSTS`):**
  - `TOUGH`: `+15% Max HP` (`Math.max(base_hp + 1, Math.ceil(base_hp * 1.15))`) — uppfærir bæði `boosted_max_hp` og upphaflegt `current_monster_hp` í `encounters`.
  - `AGGRESSIVE`: `+1 Attack Bonus` — bætist við `monster_ab` í `src/domain/combat/engine.js`.
  - `BRUTAL`: `+1 Damage` — bætist við skaðann í öllum árásum skrímslisins (`ATTACK`, `DRINK_POTION` og misheppnað `FLEE`) í `src/domain/combat/engine.js`.
  - Pathfinder `special_abilities` eru flett upp eftir `base_monster_name` í `src/domain/combat/abilities.js` svo sérnöfn skrímsla brjóti aldrei sérhæfileika þeirra.
- **Balance og Level 1 öryggi:**
  - Fyrir Level 1 hetjur velur kerfið eingöngu svæði í fjarlægð `<= 3` frá Oakhaven og skrímsli með `solo_level === 1` og `challenge_rating <= 0.5`.
  - Verðlaunafé (`calculateBountyRewardGold`) skalar frá ~37–55 gulli á fyrstu stigum (eingöngu gull, ekkert auka XP), sem gerir spilara kleift að safna fyrir Healing Potions og búnaði eftir 1–2 vel heppnaðar veiðiferðir.

---

## 5. Refresh, Abandon og Permadeath reglur

- **Vörn gegn ókeypis rerolls við Refresh og Abandon:**
  - `getOrGenerateContracts` notar deterministic framvindufræ (`characterId : Level : CompletedContracts : CombatCount`) og telur samninga sem hefur verið hafnað (`ABANDONED`) á núverandi framvindustigi upp í 3ja samninga kvótann.
  - Refresh á síðu breytir aldrei samningum. Ef spilari gerir `Accept -> Abandon` í Oakhaven án þess að fara út í óbyggðirnar og berjast fær hann ekki nýja ókeypis samninga í staðinn fyrr en hann hefur lokið bardaga eða hækkað um level.
- **Permadeath samspil (`handlePlayerDeath` í `src/domain/monsters/persistence.js`):**
  - Ef hetja deyr áður en hún kemst aftur til Oakhaven breytast allir `ACTIVE` og `READY_TO_CLAIM` samningar hennar í `FAILED` og engin verðlaun greiðast út.
  - Ef hetjan fellur fyrir Named Bounty skrímsli breytist skrímslið í global `monster_instances` á þeim reit, heldur sérnafni sínu í `monster_instances.custom_title` og reiknar hámarkslíf sem `Math.max(Math.ceil(base_hp * 1.10), bounty_boosted_max_hp)` svo `TOUGH` (+15%) og persistent (+10%) leggist aldrei tvöfalt saman.

---

## 6. Prófanir (`tests/watcher_board_bounties.test.js`)

Öll **214 sjálfvirk próf** í **16 prófunarsvítum** keyra græn (`npm test`), þar á meðal nýja svítan `tests/watcher_board_bounties.test.js` sem sannreynir:
1. Stofnun og varanleika 3ja Hunting Contracts með sérnöfnum, einum boost og gildum svæðum.
2. Regluna um aðeins 1 virkt verkefni í einu (bæði í domain logic og SQLite partial unique index).
3. `Accept` og `Abandon` líftíma ásamt vörn gegn ókeypis rerolls í Oakhaven.
4. Encounter-líkur innan (40% * 75%) og utan (25% / 0%) veiðisvæðis, forgang global persistent monsters og Stage 1 leynd (`DISCOVERED` vs `IN_COMBAT`).
5. Raunveruleg áhrif `TOUGH`, `AGGRESSIVE` og `BRUTAL` í bardagakerfinu.
6. Að venjulegt skrímsli sömu tegundar klári ekki samning, að sigur á skotmarki setji `READY_TO_CLAIM` án tafarlausra gullverðlauna, og að sjálfvirk útborgun (`autoClaimCompletedBounties`) fari fram við komu til Oakhaven án tvígreiðslu.
7. Permadeath-samspil (`FAILED` samningur og kynning Named Bounty skrímslis yfir í `monster_instances` með varðveittu `custom_title` og ósamsettu HP).
8. Leynd og birtingu á **Threats in the Wilderness** (eingöngu átt frá Oakhaven og `killCount`).
9. EJS viðmóts- og HTML-prófun fyrir `#modal-bounties`, `.bounty-art-frame`, `Wanted Quarry` og `victory.ejs`.
