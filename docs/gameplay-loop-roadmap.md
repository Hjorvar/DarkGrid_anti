# DARKGRID — Gameplay Loop Roadmap & MVP Specification

**Dagsetning:** 14. október 2026  
**Hlutverk:** Senior Game Designer & Systems Designer  
**Tengt skjal:** [`docs/gameplay-loop-review.md`](gameplay-loop-review.md)  
**Staða:** Tillaga að fyrstu útfærslu (MVP) — Bíður samþykkis áður en kóðun hefst

---

## 1. Hvaða EINA eiginleika ætti að útfæra fyrst? (MVP Val)

### Ráðlegging: **The Watcher's Board — Nemesis Bounties & Warden's Hunting Contracts**

Í stað þess að smíða flókið sögu- eða handverkskerfi mælum við með að fyrsta útfærsla (MVP) sé **The Watcher's Board** í Oakhaven — lítið, samsett kerfi sem sameinar:
1. **Nemesis Bounties (Global Persistent Monsters):** Gerir núverandi `monster_instances` töflu sýnilega í Oakhaven með sjálfvirkri nafnbót í `custom_title`, síðasta þekkta hniti, hættumati og **Guild Bounty** gullverðlaunum ofan á stolið herfang.
2. **Warden's Hunting Contracts (Personal Single-Target Hunts):** 3 einfaldir veiðisamningar í Oakhaven sem biðja hetjuna um að fella **eitt tiltekið skrímsli á tilteknu landslagi** og snúa lifandi aftur til Oakhaven til að innleysa gull og XP.

---

### 1.1 Hvers vegna þetta er besta fyrsta skrefið

1. **Leysir stærsta vandamál leiksins strax:** Í dag vantar spilarann ástæðu til að velja ákveðna stefnu þegar hann gengur út úr Oakhaven. Með *The Watcher's Board* fær hver einasti leiðangur skýrt markmið (*„Ég er á leið í Raven Crags til að fella Worg fyrir 45g"* eða *„Ég ætla í Mirkwood á (5,5) til að hefna fyrri hetjunnar minnar"*).
2. **80% af bakendanum er nú þegar til í kóðanum:**
   * `monster_instances` geymir nú þegar `tile_x`, `tile_y`, `kill_count`, `held_gold` og jafnvel tóma dálkinn `custom_title`!
   * `victory.js` les nú þegar `instance.custom_title` og birtir *„A Fallen Hero Avenged"* borðann í `victory.ejs`!
   * Það eina sem vantar fyrir Nemesis-hlutann er að skrifa nafnbót í `custom_title` við dauða hetju, bæta við Guild Bounty gulli svo jafnvel skrímsli sem drápu blanka Level 1 hetju séu verðmæt, og birta listann í Oakhaven.
3. **Lagar „0-Loot Animal" vandann án þess að breyta loot-töflum:** Í stað þess að úlfar og birnir láti gullpeninga detta í skóginum, gefa *Warden's Hunting Contracts* spilaranum gull og XP í Oakhaven fyrir að halda dýrastofninum í skefjum.
4. **Breytir Permadeath úr „Game Over" í nýtt verkefni:** Þegar hetja deyr veit spilarinn að næsta hetja getur gengið að *The Watcher's Board* í Oakhaven, séð skrímslið sem drap hana á listanum og undirbúið hefndarför.

---

## 2. MVP Hönnun (Minimum Viable Product)

### 2.1 Hvernig minnsta nothæfa útgáfan (MVP) virkar frá A–Ö

1. **Skoða töfluna í Oakhaven (`(7,7)`):**
   * Í Oakhaven birtist hnappurinn **`📜 Watcher's Board`** (eða flipi í borgarviðmótinu / uppfærðum Journal glugga).
   * Efst birtast **Active Nemeses** (allt að 5 hættulegustu/nýjustu `monster_instances` með `status = 'ACTIVE'`):
     * Nafn og nafnbót: t.d. *"Gorgoroth the Ogre, Slayer of Aldric"*
     * Staðsetning: *"Raven Crags — (3, 4)"*
     * Hættumat: `💀` til `💀💀💀💀💀` (miðað við `monster.solo_level`)
     * Verðlaun: *Guild Bounty: 60g + Fallen Hero's Spoils (24g & 2 items)*
   * Þar fyrir neðan birtast **3 Warden's Hunting Contracts** fyrir núverandi hetju:
     * Hver samningur tilgreinir **1 skrímsli** og **1 landslagstegund (`terrain`)**, t.d.:
       * *"Contract: Cull a Wolf in the Forests (Mirkwood Forest)"* — *Reward: 30 Gold, 50 XP*
       * *"Contract: Purge a Skeleton in the Swamps (Rotting Fen)"* — *Reward: 45 Gold, 75 XP*
2. **Samþykkja samning (`Accept Contract`):**
   * Hetja getur haft **1 virkan (`ACTIVE`) Hunting Contract** í einu (Nemesis Bounties þarf ekki að samþykkja sérstaklega — hver sem fellir Nemesis-skrímslið fær sjálfkrafa Guild Bounty við sigur).
   * Virkur samningur sést sem lítill staðalbúti (badge/tracker) í UI eða í `Journal` glugganum.
3. **Leiðangur og hærri líkur á skotmarki (Target Tracking):**
   * Þegar hetja með virkan samning gengur á reit sem passar við `target_terrain` og kveikir á 25% tilviljunarfundi, athugar `encounters/engine.js` hvort samningur sé virkur. Ef svo er, eru **35%–40% líkur** á að fundurinn velji `target_monster_id` beint (svo lengi sem CR-þak reitsins leyfir það). Þetta kemur í veg fyrir pirrandi leit.
4. **Sigur í bardaga (`Victory`):**
   * **Ef skrímslið var Nemesis (`monster_instance_id`):** Spilarinn fær strax `held_gold` + `guild_bounty_gold` (`40 × solo_level × kill_count`) + stolna hluti á `victory.ejs` skjánum.
   * **Ef skrímslið var Hunting Contract skotmark:** Staða samningsins breytist úr `ACTIVE` í `READY_TO_CLAIM` og á `victory.ejs` birtist tilkynningin: *"Contract Fulfilled! Return alive to Oakhaven to claim your reward."*
5. **Innlausn í Oakhaven (`Claim Reward`):**
   * Þegar hetjan kemur lifandi aftur til Oakhaven (`(7,7)`) getur hún smellt á **`Claim Bounty`** á *Watcher's Board*, fær gullið og XP-ið (með INT-mótara eins og venjulega), og nýr samningur kemur í staðinn.
   * Þegar hetja hvílist (`Rest`) í Oakhaven getur hún einnig endurnýjað óvalda samninga (`AVAILABLE`) ef hún hefur hækkað um level.

---

### 2.2 Hvaða hlutar núverandi kerfis sjá um virknina (Reuse)

| Núverandi eining | Hvernig hún er endurnýtt í MVP |
|---|---|
| `monster_instances` taflan (`001_initial_schema.sql`) | Geymir nú þegar `monster_id`, `tile_x`, `tile_y`, `kill_count`, `held_gold`, `custom_title`, `status`. |
| `src/domain/monsters/persistence.js` | Sér nú þegar um að búa til/uppfæra varanlegt skrímsli við permadeath; við bætum aðeins við 10 lína hjálparfalli sem býr til `custom_title` (t.d. *"Blood-Maw the Wolf, Bane of <HeroName>"*). |
| `src/domain/combat/victory.js` & `victory.ejs` | Les nú þegar `customTitle` og birtir `isAvenged` / `avengedHeroes` borðann. Við bætum aðeins `guildBountyGold` við útreikninginn og `contractFulfilled` flaggi. |
| `src/domain/encounters/engine.js` | Hefur nú þegar alla landslags- og CR-síun (`terrain`, `getDistanceToNearestSafeCity`). Við bætum við léttri vigtun fyrir virkan `target_monster_id`. |
| `src/views/game.ejs` | Hefur nú þegar borgaraðgerðir í Oakhaven (`Rest`, `Shop`) og modal-gluggakerfi (`#modal-shop`, `#modal-journal`). |

---

### 2.3 Hvað þarf að bæta við (New Additions)

1. **1 ný SQLite tafla (`hunting_contracts`):** Geymir 3 samninga í boði fyrir hetjuna og stöðu þeirra (`AVAILABLE`, `ACTIVE`, `READY_TO_CLAIM`, `COMPLETED`).
2. **1 ný léns-eining (`src/domain/bounties/board.js`):**
   * `getActiveNemeses()`: Sækir virk `monster_instances` ásamt `monsters.name`, `solo_level`, `map_tiles.name/terrain` og nöfnum fallinna hetja.
   * `getOrGenerateContracts(character)`: Býr til 3 sanngjarna samninga fyrir stig hetjunnar ef engir eru til.
   * `acceptContract(characterId, contractId)`, `abandonContract(characterId, contractId)` og `claimContractReward(characterId, contractId)`.
3. **3 nýjar Express slóðir í `src/routes/game.js`:**
   * `POST /game/bounties/accept`
   * `POST /game/bounties/abandon`
   * `POST /game/bounties/claim`
4. **UI-gluggi í `src/views/game.ejs` (`#modal-bounties`):** Hreinn, dimmur gluggi í sama stíl og `#modal-shop` sem sýnir *Active Nemeses* og *Warden's Contracts*, auk lítillar línu í Oakhaven og `#modal-journal` sem minnir spilarann á virkan samning.

---

### 2.4 Hvaða hlutum við eigum að SLEPPA í fyrstu útgáfu (Out of Scope for v1)

Til að halda MVP-útgáfunni hreinni, hraðri og áhættulausri sleppum við eftirfarandi í v1:
* ❌ **Engir fjölþrepa eða „Kill X" samningar:** Alltaf nákvæmlega **1 skrímsli** í hverjum samningi.
* ❌ **Engir nýir hlutir í gagnagrunninn í v1:** Samningar greiða gull og XP beint við skil í Oakhaven (Wilderness Trophies/Pelts geta komið sem Phase 1.5 viðbót síðar).
* ❌ **Engir NPC samtalsgluggar:** *The Watcher's Board* er tilkynningatafla með skýrum hnöppum, nákvæmlega eins og verslunin.
* ❌ **Engir tímamælar (Real-time timers) eða bakgrunnsþjónustur:** Samningar renna aldrei út á klukku.
* ❌ **Engin breyting á bardagareglum (`combat/engine.js`):** Bardaginn sjálfur virkar 100% eins og áður.

---

## 3. Tæknilegar forsendur og Gagnagrunnsbreytingar

### 3.1 Fyrirhugað Migration (`db/migrations/012_add_hunting_contracts.sql`)

Engin breyting er nauðsynleg á `monster_instances` þar sem `custom_title TEXT` er þegar til staðar í `001_initial_schema.sql`. Við bætum aðeins við einni töflu:

```sql
CREATE TABLE IF NOT EXISTS hunting_contracts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    character_id INTEGER NOT NULL,
    target_monster_id INTEGER NOT NULL,
    target_terrain TEXT NOT NULL,
    region_name TEXT NOT NULL,
    contract_title TEXT NOT NULL,
    flavor_text TEXT NOT NULL,
    reward_gold INTEGER NOT NULL,
    reward_xp INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK (
        status IN ('AVAILABLE', 'ACTIVE', 'READY_TO_CLAIM', 'COMPLETED')
    ),
    created_at_level INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
    FOREIGN KEY (target_monster_id) REFERENCES monsters(id)
);

CREATE INDEX IF NOT EXISTS idx_hunting_contracts_char_status
    ON hunting_contracts(character_id, status);
```

### 3.2 Reglur fyrir samningagerð (Contract Generation & Balance Rules)

Til að tryggja að samningar leiði spilara **aldrei** í dauðagildru (Suicide Trap) eða valdi XP/Gull-verðbólgu:
1. **Hættumörk (`solo_level` filter):**
   * Á **Level 1**: Samningar velja aðeins skrímsli með `solo_level = 1` og `cr <= 0.5` á landslagi sem er aðgengilegt í 1–3 skrefa fjarlægð frá Oakhaven (`PLAINS`, `FOREST`, `HILLS`).
   * Á **Level 2+**: Samningar velja skrímsli með `solo_level` á bilinu `[max(1, character.level - 1), min(5, character.level + 1)]` á færum óbyggðareitum (`PLAINS`, `FOREST`, `HILLS`, `SWAMP`, `JUNGLE`).
2. **Verðlaunaformúla (Reward Math):**
   * `reward_gold = Math.round(20 * monster.solo_level + (monster.cr * 15))` (t.d. ~25g–35g á Level 1, ~65g–95g á Level 3).
   * `reward_xp = Math.round(monster.xp_reward * 0.5)` (50% bónus ofan á XP skrímslisins, háð INT-mótara hetjunnar við innlausn).
3. **Guild Bounty á Nemesis (`monster_instances`):**
   * `guildBountyGold = Math.round(35 * monster.solo_level * Math.max(1, instance.kill_count))`
   * Þetta bætist við `instance.held_gold` þegar Nemesis er sigraður, þannig að jafnvel Nemesis sem drap Level 1 hetju með 0g gefur a.m.k. `35g` í verðlaun!
4. **Vörn gegn misnotkun (Anti-Abuse):**
   * Samningur greiðir **aðeins** út þegar hetjan er stödd í Oakhaven (`tile.is_safe === 1 && tile.terrain === 'CITY'`).
   * Ef hetja hættir við samning (`Abandon Contract`), kemur ekki nýr samningur í staðinn fyrr en hetjan hefur klárað a.m.k. 1 bardaga í óbyggðum (kemur í veg fyrir að spilarar spammi „Abandon" í borginni til að velja auðveldasta skrímslið).

---

## 4. Tillögur að UI-breytingum (English-Only Player Text)

Allur texti í viðmótinu fylgir `.agents/rules/language.md` (eingöngu á ensku) og `.agents/rules/game-ui.md` (dökkur, drungalegur stíll):

1. **Borgarspjald í Oakhaven (`game.ejs`):**
   * Við hlið `Rest at Sanctuary` og `Visit Marketplace` bætist við hnappurinn:
     * **`📜 The Watcher's Board`** (með gullnum/rauðum punkti ef samningur er `READY_TO_CLAIM` eða ef virkur Nemesis er á kortinu).
2. **Modal-gluggi (`#modal-bounties`):**
   * **Hluti 1: `🩸 Active Nemeses — Fallen Heroes Unavenged`**
     * Ef enginn Nemesis er á lífi: *"The wilds are quiet. No known hero-slayers roam the realm."*
     * Ef Nemesis er virkur: Sýnir nafnbót (`custom_title`), síðasta þekkta svæði og hnit `(X, Y)`, hættumat (`💀`), fórnarlömb og *Guild Bounty + Held Spoils*.
   * **Hluti 2: `🗡️ Warden's Hunting Contracts`**
     * Sýnir 3 spjöld með titli, lýsingu, landslagi (`Target Ground: Mirkwood Forest`), hættumati og verðlaunum (`Reward: 35 Gold · 65 XP`).
     * Hnappar: `Accept Contract`, `Abandon`, eða `Claim Reward` (þegar `READY_TO_CLAIM`).
3. **Virkt markmið á aðalskjá / Journal:**
   * Lítil, snyrtileg lína í upplýsingaspjaldinu eða `#modal-journal`:
     * `🎯 Active Hunt: Slay a Wolf in Mirkwood Forest (FOREST)` eða `✅ Hunt Complete: Return to Oakhaven to claim 35g`.

---

## 5. Framkvæmdaröð (Implementation Sequence)

Þegar ákvörðun um innleiðingu hefur verið tekin er mælt með eftirfarandi 5 skrefa röð:

1. **Skref 1 — Database Migration (`012_add_hunting_contracts.sql`):**
   * Búa til `hunting_contracts` töfluna og keyra `npm run setup:db`.
2. **Skref 2 — Nemesis Titles & Bounty Domain (`src/domain/monsters/persistence.js` & `src/domain/bounties/board.js`):**
   * Bæta við sjálfvirkri `custom_title` nafngjöf þegar hetja fellur í bardaga.
   * Útfæra `board.js` með `getActiveNemeses()`, `getOrGenerateContracts()`, `acceptContract()`, `abandonContract()` og `claimContractReward()`.
3. **Skref 3 — Encounter Weighting & Victory Integration (`src/domain/encounters/engine.js` & `src/domain/combat/victory.js`):**
   * Í `engine.js`: Ef hetja er með `ACTIVE` samning á núverandi `terrain` og CR-þakið leyfir skrímslið, gefa 35%–40% líkur á að velja samningsskrímslið þegar tilviljunarfundur á sér stað.
   * Í `victory.js`: Merkja samning sem `READY_TO_CLAIM` við sigur á samningsskrímsli, og bæta `guildBountyGold` við verðlaun þegar Nemesis (`monster_instance_id`) er felldur.
4. **Skref 4 — Express Routes & Oakhaven UI (`src/routes/game.js`, `src/views/game.ejs`, `src/views/victory.ejs`):**
   * Tengja `/game/bounties/*` slóðirnar og bæta `#modal-bounties` og stöðuvísi í `game.ejs` og `victory.ejs`.
5. **Skref 5 — Sjálfvirk próf (`tests/`):**
   * Skrifa eininga- og samþættingarpróf fyrir Nemesis-nafngjöf, samningagerð, CR-öryggismörk á Level 1, bardagasigur og innlausn í Oakhaven.

---

## 6. Prófanir og Acceptance Criteria

### 6.1 Hvernig við prófum hvort kerfið sé raunverulega skemmtilegt (Playtest Checklist)
* **5 mínútna prófið:** Stofnaðu nýja Level 1 hetju í Oakhaven. Opnaðu *The Watcher's Board*, veldu samning (t.d. í *Mirkwood Forest*), gakktu norður í skóginn, finndu skotmarkið, sigraðu það og komdu aftur til Oakhaven til að innleysa gullið og kaupa betra vopn. *Tilfinningin á að vera eins og heill, lokaður smá-leiðangur.*
* **Permadeath-prófið:** Láttu hetju deyja gegn skrímsli á óbyggðareit. Stofnaðu nýja hetju, opnaðu *The Watcher's Board* í Oakhaven og staðfestu að morðinginn birtist þar með drungalegri nafnbót, hniti og verðlaunafé.

### 6.2 Acceptance Criteria (fyrir framtíðarinnleiðingu)
- [ ] **AC-1 (Nemesis Title & Board):** Þegar hetja deyr í bardaga fær skrímslið í `monster_instances` sjálfkrafa enska nafnbót í `custom_title` (t.d. *"Grimclaw the Wolf, Bane of <Hero>"*) og birtist á *The Watcher's Board* í Oakhaven með hniti, fjölda fórnarlamba og Guild Bounty verðlaunum.
- [ ] **AC-2 (Level-Safe Contracts):** Hver lifandi hetja sér 3 *Warden's Hunting Contracts* á *The Watcher's Board*. Á Level 1 eru öll skotmörk með `solo_level = 1` og `cr <= 0.5` á aðgengilegu landslagi (`PLAINS`, `FOREST`, `HILLS`).
- [ ] **AC-3 (Single Active Contract):** Hetja getur aðeins haft 1 `ACTIVE` samning í einu.
- [ ] **AC-4 (Target Tracking):** Þegar hetja með `ACTIVE` samning fær tilviljunarfund á réttu `target_terrain` (og fjarlægðar-CR leyfir), eru auknar líkur (35%–40%) á að fundurinn sé gegn samningsskrímslinu.
- [ ] **AC-5 (Extraction & Claim):** Sigur á samningsskrímsli breytir stöðu samnings í `READY_TO_CLAIM`. Gull og XP greiðast aðeins út þegar hetjan er komin lifandi aftur í Oakhaven (`POST /game/bounties/claim`).
- [ ] **AC-6 (Nemesis Payout):** Sigur á Nemesis (`monster_instance_id`) greiðir bæði `held_gold` og `guildBountyGold` og birtir `custom_title` skrímslisins á `victory.ejs`.
- [ ] **AC-7 (English-Only UI):** Allur texti á *Watcher's Board*, í samningum og á sigurskjá er 100% á ensku og engar faldar tölur (HP/AC/CR) eru sýndar spilaranum.

---

## 7. Möguleg framtíðarútvíkkun (Phase 2 & Phase 3)

Þegar MVP-útgáfan af *The Watcher's Board* er komin í loftið er auðvelt að byggja ofan á hana í tveimur litlum skrefum:
1. **Næsta skref (Landmark Mysteries):** Virkja `map_tiles.feature` (`ANCIENT_OAK`, `SUNK_RUIN`, `ANCIENT_BRIDGE` + 6 ný landamerki) og leyfa *Watcher's Board* einnig að bjóða upp á könnunarsamninga (*"Survey the Sunken Ruin at Deadman's Mire"*).
2. **Þar næsta skref (Field Journal & Bestiary):** Uppfæra `#modal-journal` þannig að hann geymi *Bestiary Field Notes* (upplýsingar um DR og sérhæfileika skrímsla sem spilarinn hefur mætt) og *Chronicle of the Fallen* á milli hetja sama notanda (`user_id`).

---

## 8. Óútkljáðar hönnunarákvarðanir sem þurfa samþykki (Open Decisions)

Áður en við byrjum að forrita MVP-ið þurfum við stutt svar/samþykki við þessum 4 spurningum:

1. **Nákvæm staðsetning Nemesis-skrímsla á töflunni:**
   * *Valkostur A (Mælt með):* Sýna bæði nafn svæðis og nákvæmt hnit á *Watcher's Board* (t.d. *"Mirkwood Forest — (5, 4)"*) svo spilarinn geti fundið skrímslið á 15×15 kortinu án þess að leita í blindni.
   * *Valkostur B:* Sýna aðeins nafn svæðis og átt frá Oakhaven (t.d. *"Mirkwood Forest — Northwest of Oakhaven"*) og láta 5×5 minimap `💀` táknið sjá um síðustu 2 reitina.
2. **Innlausn á Nemesis Bounty vs. Hunting Contract:**
   * *Valkostur A (Mælt með):* Nemesis Bounty greiðist strax á sigurskjánum (`victory.ejs`) ásamt stolna herfanginu (þar sem `victory.ejs` er nú þegar með *A Fallen Hero Avenged* skjáinn), en *Warden's Hunting Contracts* krefjast þess að spilarinn komist lifandi aftur til Oakhaven til að innleysa verðlaunin.
   * *Valkostur B:* Bæði Nemesis Guild Bounty og Hunting Contracts krefjast þess að snúa aftur til Oakhaven.
3. **Endurnýjun á samningum (Contract Refresh):**
   * *Valkostur A (Mælt með):* Nýr samningur kemur sjálfkrafa í staðinn þegar samningur er kláraður (`COMPLETED`), og allir óvaldir (`AVAILABLE`) samningar endurnýjast þegar hetja hækkar um level eða hvílist í Oakhaven eftir a.m.k. 3 bardaga.
   * *Valkostur B:* Samningar endurnýjast í hvert einasta skipti sem ýtt er á `Rest` í Oakhaven.
4. **Wilderness Trophies (`ANIMAL` loot):**
   * Viljum við láta *Hunting Contracts* eina og sér sjá um verðlaun fyrir `ANIMAL` dráp í MVP, eða viljum við samtímis bæta við 6–8 einföldum *Pelt/Tusk* hlutum (`TREASURE` flokkur) í `item_definitions` svo dýr geti líka skilið eftir sig seljanlega feldi utan samninga?
