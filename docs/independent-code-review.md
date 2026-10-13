# DARKGRID — Independent Code Review

> **Úttektaraðili:** Óháður Senior Software Engineer / Security Reviewer / Game Systems Auditor (AI)
> **Dagsetning:** 13. október 2026
> **Útibú / HEAD:** `main` @ `2691249` (*feat(combat): implement two-handed weapon shield suppression and healing potion selection…*)
> **Umfang:** `src/`, `db/migrations`, `db/seeds`, `tests/`, `public/`, `package.json`, `README.md`, `AGENTS.md`, `.agents/`, `docs/` (þ.m.t. `docs/pre-merge-audit.md`)
> **Aðferð:** Lesin öll keyrsluleið (routes → domain → SQLite → views), keyrð prófunarsvíta í einangruðum gagnagrunni, og skrifuð sjálfstæð endurtekningarpróf (reproduction harness) á **in-memory SQLite** og á **afriti** af raunverulega gagnagrunninum (read-only).
> **Takmarkanir virtar:** Engum kóða, reglum, migrations eða `data/darkgrid.sqlite` var breytt. SHA-256 af `data/darkgrid.sqlite` var staðfest óbreytt fyrir og eftir allar keyrslur (`2DD5FFF6…494C4F`). Eina varanlega skráin er þessi skýrsla.

---

## 0. Niðurstaða í hnotskurn

### **Mat: NOT READY FOR PLAYTESTING**

Kjarninn (d20-vél, flokkareglur, XP, loot-töflur, permadeath-útreikningar, SQL-öryggi, CSRF) er að mestu vel útfærður í **domain-laginu**. En nokkrar villur, sem engin af 101 prófunum grípur, brjóta grunnlykkju leiksins eða leyfa leikmanni að komast framhjá permadeath:

1. **Ekki er hægt að setja á sig (equip) eða taka af sér (unequip) búnað í gegnum viðmótið.** Allur keyptur, rændur eða markaðsbúnaður er ónothæfur fyrir venjulegan leikmann. (C1)
2. **Leikmaður getur yfirgefið bardaga án fríárásar** með því að senda `POST /game/encounter/ignore` eða `/game/encounter/conclude` í miðjum bardaga. Þetta gerir permadeath-hættuna valfrjálsa. (C2)
3. **`npm test` skrifar í raunverulega leikjagagnagrunninn** (`data/darkgrid.sqlite`). 255 af 262 notendum þar eru prófunarnotendur og 4 hetjur eru fastar `IN_COMBAT` inni í borginni. (C3)
4. **Leikmaður sér aldrei niðurstöðu bardaga.** Sigur, XP, loot og level-up eru vistuð en aldrei birt. (H3)

Flestar lagfæringarnar eru litlar (1–20 línur hver). Eftir að C1–C3, H1–H4 hafa verið lagfærð og próf bætt við er raunhæft að meta stöðuna sem **READY WITH WARNINGS**.

### Yfirlit yfir atriði

| # | Alvarleiki | Atriði | Staða |
|---|---|---|---|
| C1 | CRITICAL | Equip/Unequip-form í viðmóti senda ógild gögn — búnaður ónothæfur | **Staðfest (HTTP)** |
| C2 | CRITICAL | Ignore/Conclude virka í `IN_COMBAT` → flótti án fríárásar | **Staðfest (HTTP)** |
| C3 | CRITICAL | Prófunarsvítan skrifar í lifandi `data/darkgrid.sqlite` | **Staðfest (gögn)** |
| H1 | HIGH | Tvöföldun gulls / munaðarlaust loot þegar tvær hetjur berjast við sama persistent monster | **Staðfest (domain)** |
| H2 | HIGH | Persistent monster byrjar ekki nýjan bardaga með fullt HP (brot á samþykktri reglu) | **Staðfest (domain)** |
| H3 | HIGH | Sigur, loot, XP, level-up og banvænt Opening Shot eru aldrei sýnd leikmanni | **Staðfest (HTTP)** |
| H4 | HIGH | Falin, óskjalfest, óprófuð initiative-regla sem gildir aðeins í framleiðslu | **Staðfest (domain)** |
| H5 | HIGH | Prófunarsvítan er óákveðin (flaky) — „101/101“ er ekki endurtakanlegt | **Staðfest (keyrsla)** |
| M1 | MEDIUM | Viðmót sýnir rangt AC / virkt vopn gegn fljúgandi skrímslum | **Staðfest (HTTP)** |
| M2 | MEDIUM | Bardagatextar: rangt reitarheiti → skrímslasértækir textar virka aldrei; Sling lýst sem „blade“ | **Staðfest** |
| M3 | MEDIUM | Session/auth harðgerð: harðkóðað leyndarmál, `.env` aldrei lesið, engin session-endurnýjun, MemoryStore, engin rate-limit | **Staðfest (kóði)** |
| M4 | MEDIUM | Lífshætta nýrra hetja við borgarhlið (Orc CR ⅓ drepur 8-HP hetju í einu höggi í 46% högga) | **Staðfest (útreikningur)** |
| M5 | MEDIUM | Venjulegt loot er dregið jafnt úr öllum 53 hlutum (t.d. Full Plate 1500 gp frá Goblin) | **Staðfest (útreikningur)** |
| M6 | MEDIUM | Ókeypis „Club“ (0 gp) → ótakmarkaður fjöldi `item_instances` raða með POST | **Staðfest (kóði)** |
| M7 | MEDIUM | Opinberar þróunarsíður birta CR, búsvæði og íslenska texta (brot á leynd og tungumálastefnu) | **Staðfest (kóði)** |
| M8 | MEDIUM | Ambush hefur engin vélræn áhrif nema að hindra Opening Shot; viðmótstexti villandi | **Staðfest (kóði)** |
| L1–L14 | LOW | Snyrting, villandi textar, dauður kóði, smávillur | Sjá kafla 5 |

---

## 1. Prófunarumhverfi og sönnunargögn

| Atriði | Niðurstaða |
|---|---|
| Node | v24.19.0 (`node:sqlite`, `DatabaseSync`) |
| `npm test` í einangruðum gagnagrunni (`DB_PATH=%TEMP%\…\test_run.sqlite`) | **100 pass / 1 fail** (101 próf) |
| `tests/pre_merge_fixes.test.js` keyrt 14 sinnum á ferskum gagnagrunni | **6 af 14 keyrslum féllu** (próf 6) |
| Endurtekningarpróf | `scratch/repro.js`, `scratch/lethality.js`, `scratch/loot_economy.js`, `scratch/data_query.js`, `scratch/inspect_*.js` í artifact-möppu úttektarinnar (in-memory DB eða read-only afrit) |
| Raunverulegur gagnagrunnur | Aðeins lesinn í gegnum **afrit** í `%TEMP%`; hash óbreytt |

> [!NOTE]
> Raunverulegur gagnagrunnur var **aldrei** opnaður með skrifheimild. Allar fullyrðingar um innihald hans byggja á afriti sem var tekið kl. 09:58.

---

## 2. CRITICAL

### C1 — Equip og Unequip virka ekki í gegnum viðmótið

**Skrár og línur**
- [`src/views/game.ejs` L578–582](../src/views/game.ejs): Equip-formið sendir aðeins `_csrf` og `itemInstanceId`. **Það vantar `targetSlot`.**
- [`src/domain/character/rules.js` L635–638](../src/domain/character/rules.js): `equipItem` hafnar öllu nema `MELEE|RANGED|ARMOR|SHIELD`.
- [`src/views/game.ejs` L556](../src/views/game.ejs): Unequip-formið notar `item.instance_id`. [`getCharacterEquipment` (rules.js L541–548)](../src/domain/character/rules.js) skilar hins vegar `ii.id` sem `id`, og reiturinn `instance_id` er ekki til. Gildið verður því tómt.

**Endurtekning (staðfest með raunverulega birtu HTML í `scratch/repro.js`, R1/R2)**
```
equip forms rendered: 5  fields: {"_csrf":"…","itemInstanceId":"4"}
POST equip (exact UI fields)   -> /game?error=Invalid equipment slot: null. Allowed: MELEE, RANGED, ARMOR, SHIELD.
unequip forms rendered: 4  itemInstanceId values: ["","","",""]
POST unequip (exact UI fields) -> /game?error=Item not found in character possession.
```

**Áhrif:** Öll framvinda í búnaði er lokuð: búðarkaup, loot, endursölumarkaður, +1/+2 gripir og val á tvíhentu vopni. Vegna þess að `sellItem` hafnar búnaði sem er í notkun ([shop.js L181–183](../src/domain/economy/shop.js)) og ekki er hægt að unequip-a, getur leikmaður heldur ekki selt upphafsbúnað sinn. Fyrri úttekt fullyrti „100% samþætt í birgðum“, en það er rangt fyrir viðmótið.

**Tillaga að lagfæringu:**
- Bæta við `<input type="hidden" name="targetSlot" value="…">` sem er leitt af `category` / `weapon_range_type` (WEAPON+RANGED→`RANGED`, WEAPON→`MELEE`, ARMOR→`ARMOR`, SHIELD→`SHIELD`), eða leyfa `equipItem` að leiða slot út sjálft ef það vantar.
- Breyta `item.instance_id` → `item.id` í L556.

**Próf sem vantar:** HTTP-integration próf sem les **raunverulega birtu formin** úr `/game`, sendir þau óbreytt og staðfestir `equipped_slot` í gagnagrunni (equip, unequip, síðan sell).

---

### C2 — Hægt að flýja bardaga án Attack of Opportunity (Ignore/Conclude í `IN_COMBAT`)

**Skrár og línur**
- [`src/domain/encounters/engine.js` L379–398](../src/domain/encounters/engine.js): `ignoreEncounter` samþykkir `status IN ('DISCOVERED', 'IN_COMBAT')` (L383).
- [`src/domain/encounters/engine.js` L423–442](../src/domain/encounters/engine.js): `concludeEncounter` („Phase 1 standoff“) gerir það sama (L427) og setur `ESCAPED`.
- [`src/routes/game.js` L229–242, L265–278](../src/routes/game.js): Leiðirnar eru opnar og athuga ekki stöðu.
- [`src/views/game.ejs` L246–251](../src/views/game.ejs): Falið `conclude`-form er **í DOM á meðan bardagi stendur yfir**. Það er hægt að virkja með einum smelli í devtools.

**Endurtekning (HTTP, `repro.js` R3, og `lethality.js`)**
```
[/game/encounter/ignore]   status IN_COMBAT -> IGNORED | hero hp 11 -> 11 | FLEE events: 0
[/game/encounter/conclude] status IN_COMBAT -> ESCAPED | hero hp 11 -> 11 | FLEE events: 0
Ignore during IN_COMBAT: status now IGNORED; movement SOUTH:true EAST:true WEST:true
```

**Áhrif:** Þetta brýtur samþykktu regluna „nákvæmlega þrjár aðgerðir“ og regluna um að flótti kosti eina fríárás ([combat-system-plan.md §2.A, §3.4](combat-system-plan.md)). Leikmaður getur barist þar til HP er lágt og sloppið síðan áhættulaust. Í samspili við H2 (HP persistent monster endurstillist ekki) og Ranger Opening Shot er hægt að „flísa“ persistent monster til dauða án nokkurrar áhættu. Prófið `encounter_stealth_reveal.test.js` L143–155 **staðfestir þessa hegðun sem rétta**, þ.e. prófið verndar villuna.

**Tillaga að lagfæringu:** Takmarka `ignoreEncounter` við `status = 'DISCOVERED'`. Fjarlægja `concludeEncounter`, leiðina og falda formið, eða takmarka það við `DISCOVERED`. Breyta prófinu í encounter_stealth_reveal svo það krefjist höfnunar.

**Próf sem vantar:** HTTP-próf: `investigate` → `POST /game/encounter/ignore` og `/conclude` → væntanlegt villusvar, staðan áfram `IN_COMBAT` og hreyfing áfram læst.

---

### C3 — `npm test` skrifar í raunverulega leikjagagnagrunninn

**Skrár og línur**
- [`tests/http_integration.test.js` L4–14](../tests/http_integration.test.js) og [`tests/pre_merge_fixes.test.js` L5–7, L29–32](../tests/pre_merge_fixes.test.js) kalla á `getDb()`.
- [`src/config/index.js` L7](../src/config/index.js): `dbPath` er `data/darkgrid.sqlite` nema `DB_PATH` sé sett. `npm test` setur það ekki.
- Prófin keyra einnig **öll seeds** (upserts) á lifandi gagnagrunninn.

**Sönnun (read-only afrit af `data/darkgrid.sqlite`)**
```
users total: 262  → Hero_ 137, CsrfUser3_ 20, RestTester_ 19, GoldTester_ 19, GSUser_ 18, UIPotUser_ 11, PotUser1_/2_ 22, PotionUser_ 8 …
characters named "Skugga-Valdi": 138
encounters on CITY tiles: ESCAPED 43, IN_COMBAT 4   ← hetjur fastar í bardaga inni í Oakhaven
```
Í einangruðu keyrslunum, þegar próf 6 fellur, deyr hetjan og **persistent Assassin Vine verður til á borgarreitnum** (`monster_instances: 1`, sjá H5). Sama gerist í lifandi gagnagrunninum við óheppilega keyrslu.

**Áhrif:** Spilunarprófunargögn mengast við hverja keyrslu á `npm test`, sem er skjalfest sem „Quick Command“ í `AGENTS.md`. Hetjur geta setið fastar `IN_COMBAT` í borginni (þær geta hvorki hvílst né skipt um búnað), og bardagi / persistent monster geta orðið til á öruggum reit. Fyrri úttekt mat lifandi gagnagrunninn „heilan“, en hann er að mestu prófunarúrgangur.

**Tillaga að lagfæringu:** Í prófunum skal nota `setDb(createTestDb())` áður en `app` er sett upp, eða setja `"test": "set DB_PATH=:memory:&& node --test …"` (cross-env). Verja `getDb()` með því að kasta villu ef `NODE_ENV==='test'` og slóðin er ekki `:memory:`. Hreinsa núverandi gagnagrunn eða búa hann til upp á nýtt **eftir samþykki eiganda**.

**Próf sem vantar:** Guard-próf sem staðfestir að `config.dbPath === ':memory:'` (eða temp-skrá) meðan prófin keyra.

---

## 3. HIGH

### H1 — Gull tvöfaldast og loot glatast þegar tvær hetjur berjast við sama persistent monster

**Skrár og línur**
- [`src/domain/combat/engine.js` L338–354](../src/domain/combat/engine.js): `executeCombatRound` athugar aldrei `monster_instances.status`.
- [`src/domain/monsters/persistence.js` L215–254](../src/domain/monsters/persistence.js): `handleMonsterDefeat` les `held_gold` (L219–222), setur `DEFEATED` en **núllstillir aldrei `held_gold`**.
- [`persistence.js` L34–42](../src/domain/monsters/persistence.js): `handlePlayerDeath` hækkar `kill_count` og flytur loot til instance, jafnvel þótt hún sé `DEFEATED`.
- `one_open_encounter_per_character` er á hverja persónu. Ekkert kemur í veg fyrir tvo samtímis encounters við sömu instance.

**Endurtekning (`repro.js` R5/R6; tveir notendur, sama reitur)**
```
after A wins: instance {"status":"DEFEATED","held_gold":100} | A gold 100 | B enc status IN_COMBAT
B continues vs DEFEATED instance -> B enc VICTORY | B gold 100 | B xp 400 | total gold minted from a 100gp hoard: 200
B (killed by already-DEFEATED instance) -> instance {"status":"DEFEATED","kill_count":2} | items now held by DEFEATED instance (unreachable): 6
```

**Áhrif:** Þetta brýtur samþykkta reglu [combat-system-plan.md §7.4](combat-system-plan.md) („Spilari B fær ekkert loot og engin tvöföldun“). Með N reikningum fæst N-falt gull og XP (skráning reikninga er ótakmörkuð). Hetja sem fellur fyrir „dauðu“ skrímsli missir allar eigur sínar varanlega í instance sem birtist aldrei aftur. Það er gagnatap.

**Tillaga að lagfæringu:** Í `executeCombatRound` og `startCombat`: ef `monster_instance_id` og `status <> 'ACTIVE'`, loka encounter með skilaboðunum „another champion has slain it“ og hvorki veita né taka neitt. Í `handleMonsterDefeat`: `UPDATE monster_instances SET held_gold = 0 … WHERE id = ? AND status = 'ACTIVE'` og athuga `changes === 1`.

**Próf sem vantar:** Fjölnotendapróf: A og B opna encounter við sömu instance, A sigrar, B reynir aðgerð og fær höfnun. Gull alls óbreytt; engir hlutir á `DEFEATED` instance.

---

### H2 — Persistent monster byrjar nýjan bardaga ekki með fullt HP

**Samþykkt regla:** „Skrímslið byrjar hvern nýjan bardaga með fullt HP miðað við sitt styrkta hámarks-HP.“ Reglan er skráð í fimm skjölum ([combat-system-plan.md L88, L226](combat-system-plan.md), `DARKGRID_GAME_SPEC.md` L268, `DARKGRID_IMPLEMENTATION_PLAN.md` L61, `OPEN_DECISIONS.md` L18).

**Skrár og línur:** [`combat/engine.js` L96–97, L239–241, L548–550](../src/domain/combat/engine.js) vista og endurnýta `monster_instances.current_hp`. [`encounters/engine.js` L229–235](../src/domain/encounters/engine.js) setur `current_monster_hp = persistentMonster.current_hp`.

**Endurtekning (`repro.js` R4)**
```
after fight #1 + flee: instance hp 22 / 33
new encounter #2 current_monster_hp at discovery: 22
fight #2 starts with monster hp: 22 (rule says full = 33)
```

**Áhrif:** Hægt er að veikja persistent monster smám saman (högg → Flee/Ignore → hvíld í borg → aftur). Í samspili við C2 verður það áhættulaust. Það dregur úr kjarna „persistent monster“-hugmyndarinnar.

**Tillaga að lagfæringu:** Við nýjan encounter / `startCombat` með `status DISCOVERED` skal nota `mi.max_hp`. Ekki skrifa bardaga-HP aftur í `monster_instances.current_hp`, eða endurstilla það við `ESCAPED`/`IGNORED`/`DEFEAT`.

**Próf sem vantar:** Bardagi → flótti → nýr encounter → `current_monster_hp === max_hp`.

---

### H3 — Leikmaður sér aldrei sigur, loot, XP eða level-up

**Skrár og línur**
- [`src/routes/game.js` L283–301](../src/routes/game.js): Eftir sigur er beint á `/game` án `info`.
- [`src/domain/encounters/engine.js` L365–374](../src/domain/encounters/engine.js): Aðeins `DISCOVERED`/`IN_COMBAT` encounters eru sóttir. Bardagaloggurinn ([game.ejs L177–194](../src/views/game.ejs)) birtist því aldrei eftir að bardaga lýkur.
- Sama gildir þegar Ranger Opening Shot drepur strax ([routes/game.js L247–260](../src/routes/game.js), [combat/engine.js L155–194](../src/domain/combat/engine.js)): ógnin hverfur einfaldlega.

**Endurtekning (`repro.js` R11, HTTP)**
```
encounter status: VICTORY | events stored: HERO_ATTACK,MONSTER_CONDITION,VICTORY,LEVEL_UP | hero level now 2
redirect after winning blow: /game
GET /game contains "battle is won": false | contains "attained Level": false | contains combat log: false
```

**Áhrif:** Óljós skilaboð. Leikmaður veit ekki hvort hann vann, hvað hann fékk eða að hann hafi hækkað um level. `9_dead`-lýsingin, sem var sérstaklega hönnuð, sést aldrei.

**Tillaga að lagfæringu:** Vista `lastResolvedEncounterId` í session eða sækja síðasta lokaða encounter innan X mínútna. Birta síðustu `combat_events` (VICTORY, LEVEL_UP og samantekt á loot: gull og nöfn hluta) einu sinni.

**Próf sem vantar:** HTTP: sigur → `GET /game` inniheldur sigurtexta, level-up texta og heiti loot-hluta.

---

### H4 — Falin initiative-regla sem gildir aðeins í framleiðslu

**Skrá og línur:** [`src/domain/combat/engine.js` L202–211](../src/domain/combat/engine.js), sérstaklega L206–208:
```js
if (!options.rng && heroDexMod >= (encounter.initiative_bonus || 0) && heroInit < monsterInit) {
  heroInit = monsterInit;   // hetjan vinnur alltaf
}
```
`investigateEncounter` kallar á `startCombat` **án** `rng` ([encounters/engine.js L415](../src/domain/encounters/engine.js)), svo þessi leið er alltaf virk í raunverulegum leik. Öll próf sem athuga initiative senda inn `rng` og geta því **aldrei** náð þessari leið.

**Endurtekning (`repro.js` R7, 1000 bardagar hvor)**
```
Kobold (init +1; hero +1): monster wins initiative — production 0.0%  vs injected-rng 48.8%
Wolf   (init +2; hero +1): monster wins initiative — production 51.4% vs injected-rng 51.8%
```

**Áhrif:** Reglan er í ósamræmi við öll skjöl (`1d20 + bonus`, jafntefli til hetju; combat-system-plan §2.C, §3.1; GAME_SPEC L234; OPEN_DECISIONS L14). Jafnvægisgreiningar og próf lýsa öðrum leik en þeim sem er keyrður.

**Tillaga að lagfæringu:** Fjarlægja línurnar, eða, ef þetta er meðvituð jafnvægisákvörðun, skrá hana í `OPEN_DECISIONS.md` og gera hana óháða því hvort `rng` sé sent inn.

**Próf sem vantar:** Próf sem kallar á `investigateEncounter` (framleiðsluleiðina) með stubbuðu `Math.random` og staðfestir að skrímsli geti unnið initiative.

---

### H5 — Prófunarsvítan er óákveðin; „101/101 pass“ er ekki endurtakanlegt

**Skrá og línur:** [`tests/pre_merge_fixes.test.js` L516–632](../tests/pre_merge_fixes.test.js), fixture L577–583: `SELECT * FROM monsters LIMIT 1` (= **Assassin Vine, CR 3, +7, 1d8+7**) er sett `IN_COMBAT` **á borgarreitnum** gegn 11-HP Fighter. Síðan er drykkur sendur í gegnum HTTP **með raunverulegu `Math.random`**.

**Sönnun (8 einangraðar keyrslur, gagnagrunnar skoðaðir eftir á)**
```
rc_1 {"alive":0,"enc":"DEFEAT","events":"POTION_USED,MONSTER_ATTACK,DEATH","monster_instances":1}   ← fellur
rc_2 {"alive":1,"enc":"ESCAPED", …,"monster_instances":0}                                            ← stenst
… 4 af 8 féllu; full svíta: 100/101
```
Þegar prófið fellur deyr hetjan. 50% hluta eyðast, hinir fara til nýs persistent monster á Oakhaven og prófið sér „0 potions“.

**Áhrif:** CI-niðurstaða er hlutkesti. Fyrri úttekt fullyrti 101/101. Prófið býr einnig til ólöglegt ástand (bardagi í borg).

**Tillaga að lagfæringu:** Nota veikt skrímsli, villtan reit og ákveðið RNG (eða stubba `Math.random`) í HTTP-prófum.

---

## 4. MEDIUM

### M1 — Viðmót sýnir rangt AC og rangt virkt vopn gegn fljúgandi skrímslum
- [`routes/game.js` L95, L110–113](../src/routes/game.js) reikna vopn og AC út frá `getEncounterById`, en það SELECT ([encounters/engine.js L308–317](../src/domain/encounters/engine.js)) inniheldur hvorki `movement_type` né `creature_type`. Bardagavélin notar hins vegar fulla monster-röð.
- **Endurtekning (R12):** `vs Manticore (FLY): UI shows AC 16, "Active: 🗡️ Melee"; engine uses AC 15, weapon Shortbow`.
- Sama orsök veldur því að Holy Radiance AC og Favored Enemy bónus birtast ekki á hetjublaði í bardaga.
- **Lagfæring:** Bæta `m.movement_type, m.creature_type, m.creature_subtype` við SELECT, eða nota `getCombatState(...).heroAC` í `/game` þegar bardagi stendur yfir.
- **Próf sem vantar:** HTTP: bardagi við FLY-skrímsli → AC í HTML === `getCombatState().heroAC`.

### M2 — Bardagatextar nota rangt reitarheiti og gróf lykilorð
- [`narrative.js` L28–29](../src/domain/combat/narrative.js) les `monster.name`, en vélin sendir encounter-röð með `monster_name` ([combat/engine.js L338–342](../src/domain/combat/engine.js)). Allir nafnatengdir textar (wolf, spider, troll, ogre, skeleton) eru því dauðir.
  **R9:** Wolf: *„The monster attacks with savage fury; its claws and teeth strike with vicious force you painfully!“* (einnig málfræðivilla: „…force you painfully“).
- [`narrative.js` L15–22](../src/domain/combat/narrative.js): Allt sem er ekki „bow“ eða „mace/hammer/flail“ telst blað. Cleric-upphafsvopnið **Sling** fær *„Your blade bites deep…“*, og sama á við Club, Spear og Quarterstaff. Crossbow-boltar verða „arrow“.
- [`narrative.js` L109](../src/domain/combat/narrative.js): „your armor holds firm“ birtist líka án brynju.
- Brýtur [combat-system-plan.md §4.A](combat-system-plan.md).
- **Próf sem vantar:** Raunverulegur `executeCombatRound` gegn Wolf → textinn inniheldur „jaws“; Sling → textinn inniheldur ekki „blade“.

### M3 — Session- og auðkenningarharðgerð
- [`config/index.js` L6](../src/config/index.js): Harðkóðað `sessionSecret` fallback, einnig í `production`. **`.env` er aldrei lesið** (engin `dotenv`, engin `--env-file`), svo `.env.example` gefur ranga mynd.
- [`routes/auth.js` L16–17, L42–43](../src/routes/auth.js): Engin `req.session.regenerate()` við innskráningu eða nýskráningu (session fixation; CSRF-middleware býr til session fyrir nafnlausa notendur).
- [`app.js` L29–41](../src/app.js): Sjálfgefið `MemoryStore` (minnisleki; sessions tapast við endurræsingu; virkar ekki í fleiri ferlum).
- [`routes/auth.js` L53](../src/routes/auth.js): `router.all('/logout')`, svo GET-útskráning er CSRF-hæf (lítil áhrif).
- Engin rate-limit á `/login` og `/register` og ótakmarkaðir reikningar, sem auðveldar H1.
- [`app.js` L72–79](../src/app.js): `err.message` birt notanda. Samtímis skráning sama notandanafns birtir hráa SQLite UNIQUE-villu ([auth/service.js L31–40](../src/domain/auth/service.js), athugun og insert eru aðskilin af `await`).

### M4 — Lífshætta nýrra hetja rétt utan borgar (City Safety virkar samkvæmt reglu en CR mælir illa höggþunga)
- City Safety er útfærð samkvæmt reglu ([encounters/engine.js L18–27](../src/domain/encounters/engine.js)). En **Orc (CR ⅓, 2d4+4)** er leyfður 1 skref frá borginni og er ⅓ af vali á eina PLAINS-reitnum þar.
- **Útreikningur (`lethality.js`, nákvæmar líkur):** Líkur á að eitt högg skrímslis drepi ferska Ranger/Cleric (8 HP) eru **16,5% / 15,1%** á fjarlægð 1 og **~17–19%** á fjarlægð 4+ (141 af 159 villtum reitum). Orc einn og sér: **46% á hvert högg**. Á fjarlægð 4+ eru ~24% encounters level ≥3 fyrir level-1 hetju.
- Ógnin er falin (leyndarregla), svo leikmaður velur Investigate blint. Eftir afhjúpun er eina löglega undankomuleiðin Flee með fríárás (sem C2 fer í kringum í dag).
- **Tillaga (án reglubreytingar):** Skrá sem opna ákvörðun hvort City Safety eigi að taka mið af hámarksskaða (t.d. `max_damage < hero_hp`) fyrir fjarlægð 1–2. Bæta við jafnvægisprófi.

### M5 — Venjulegt loot er ekki CR-kvarðað
- [`loot.js` L106–130](../src/domain/combat/loot.js): Ef hlutur fellur er hann dreginn **jafnt** úr öllum 53 venjulegu hlutunum, þar á meðal Full Plate 1500 gp og Half-Plate 600 gp.
- **Útreikningur:** Meðal endursöluverð hlutar er 41,7 gp. Fyrir CR ⅓ Standard skrímsli er E[gull] = 1,65 gp en E[endursala hlutar] = **8,35 gp**. 11,3% af hlutum sem falla eru ≥200 gp. Hagkerfið stjórnast af slembibrynjum frá Goblin.
- Skjöl skilgreina ekki val á venjulegum hlutum, svo þetta er **NOT VERIFIED gagnvart spec** og flokkast sem áhætta, ekki staðfest regluvilla.

### M6 — Ókeypis „Club“ leyfir ótakmarkaðan fjölda raða
- `Club` hefur `buy_price = 0`. [`shop.js` L124–145](../src/domain/economy/shop.js) athugar `gold < price` (0 < 0 er ósatt) og býr til nýja `item_instances` röð í hvert sinn. Enginn birgðaþak er til. Endurtekin POST beiðni getur fyllt gagnagrunninn (og síðar 20-hluta forgangsröðun við dauða).
- **Lagfæring:** Lágmarksverð 1 gp eða birgðaþak, og rate-limit.

### M7 — Opinberar þróunarsíður brjóta leynd og tungumálastefnu
- [`app.js` L20](../src/app.js) birtir allt `public/`, þar á meðal `public/monster_review.html` og `public/monster_comparison.html`. Þar sést **CR, búsvæði og íslenskur texti** (t.d. „CR 3 · Planta · Búsvæði: Skógur…“) án innskráningar.
- Brýtur `.agents/rules/encounter-design.md` (CR skal aldrei sjást) og `.agents/rules/language.md` (enska ein fyrir leikmenn).

### M8 — Ambush er nær áhrifalaust en viðmótið gefur annað í skyn
- [`encounters/engine.js` L260–282](../src/domain/encounters/engine.js): Perception-kast ákvarðar `is_ambush`. Eina afleiðingin er að Opening Shot er hindrað ([combat/engine.js L109–116](../src/domain/combat/engine.js)). Fyrir Fighter og Cleric hefur ambush **engin** áhrif, og Ignore er áfram í boði.
- [`game.ejs` L147–151](../src/views/game.ejs) segir „The creature lunged from hiding…“ þótt engin árás eigi sér stað.
- Persistent monsters eru alltaf `spotted_by_hero = 1, is_ambush = 0` ([encounters/engine.js L226](../src/domain/encounters/engine.js)), svo Ranger fær alltaf Opening Shot á þau.
- Skjöl skilgreina ekki önnur ambush-áhrif. Þetta er **villandi viðmót**, ekki staðfest regluvilla.

---

## 5. LOW

| # | Skrá / lína | Atriði | Tillaga |
|---|---|---|---|
| L1 | [`game.ejs` L571–585, L640–652](../src/views/game.ejs) | Backpack og Sell-listi sýna **búnað sem er í notkun** með Equip/Sell-hnöppum, sem gefa villu (R1: 4 sell-form fyrir equipped hluti). | Sía `equipped_slot IS NULL`. |
| L2 | [`game.ejs` L641](../src/views/game.ejs) | Sýnt söluverð drykkja er 40% (Minor Healing Potion er `is_magical=1`) en þjónn greiðir 50% ([shop.js L186–188](../src/domain/economy/shop.js)). | Samræma formúlu. |
| L3 | [`character/rules.js` L240–285](../src/domain/character/rules.js) | Cleric Self-Heal við fullt HP eyðir notkun (R13: `healed 0, remaining 1`). Viðmótið gerir hnappinn óvirkan en þjónninn hafnar ekki. | Hafna ef `current_hp >= max_hp`. |
| L4 | [`combat/engine.js` L476–483](../src/domain/combat/engine.js) | Drykkur við fullt HP eyðist; logg skráir kastað gildi en ekki raunverulega lækningu. | Skrá `actualHealed`; mögulega aðvörun í viðmóti. |
| L5 | [`routes/game.js` L333–353](../src/routes/game.js) | Flee sendir ekki `round`. Tvísmellur skilar villunni „status is ESCAPED“. | Senda `round` eða þagga villuna. |
| L6 | [`create-character.ejs` L88](../src/views/create-character.ejs), [`rules.js` L417–429](../src/domain/character/rules.js) | `favoredEnemyType='ANIMAL'` vistast líka á Fighter og Cleric. Gildi eru ekki staðfest gagnvart leyfðum lista. Ranger án vals fær aldrei bónus. | Hvítlisti; `NULL` fyrir aðra flokka. |
| L7 | [`config/index.js` L10–11](../src/config/index.js) | `ENCOUNTER_CHANCE_PERCENT=0` er ómögulegt (`0 \|\| 25`). | Nota `??` og `Number.isFinite`. |
| L8 | [`dice.js` L50–54](../src/domain/combat/dice.js) | Óþekkt formúla (t.d. `2d4+1d6`) verður hljóðlaust `1d4`. Engin núverandi gögn verða fyrir áhrifum (R8: 0), en þetta er dulin áhætta. | Kasta villu eða skrá aðvörun. |
| L9 | [`game.ejs` L397](../src/views/game.ejs) | Fastur textinn „Minor Elixir (1d8+1 HP)“ birtist óháð því hvaða drykkir eru til. | Sýna raunverulega drykki. |
| L10 | [`persistence.js` L44–58](../src/domain/monsters/persistence.js) | Ef persistent monster verður til á reit meðan annar leikmaður berst við random skrímsli þar, er dauðinn skráður á **rangt** skrímsli (minningarskjár sýnir rangt nafn). | Búa til nýtt instance eða hafna. |
| L11 | [`db/migrate.js` L59–83](../src/db/migrate.js) | Öll seeds (upserts) keyra við **hverja** ræsingu og yfirskrifa monster-, item- og kortagögn. Breytingar migration 004 á Wolf/Troll eru yfirskrifaðar. Migration 004 vísar í þróunarsértæk auðkenni („character 2“). | Keyra seeds aðeins í setup, eða skrá í `schema_migrations`. |
| L12 | `git ls-files data/` | Þrjú DB-afrit eru í git; eitt þeirra inniheldur 45 bcrypt-hashes. | Fjarlægja úr sögu og bæta við `.gitignore` (`*.backup-*`). |
| L13 | Ýmsar skrár | **Dauður eða prófamiðaður kóði:** ofhlaðnar undirskriftir í `calculateHeroAC` ([combat/rules.js L89–117](../src/domain/combat/rules.js)) og `getClericHolyRadianceBonus` ([rules.js L155–172](../src/domain/character/rules.js)); `is_flying` sem er ekki í schema ([rules.js L743–746](../src/domain/character/rules.js)); slot-samheiti `MAIN_HAND/CHEST/OFF_HAND/PREPARED_*` sem eru aldrei skrifuð (L555–572); ónotuð `sell_price`, `equip_slot` og `game_config`; `concludeEncounter`; `getCharacterById` er flutt inn í prófi en er ekki til. | Fjarlægja eða einfalda. |
| L14 | `monsters.solo_level` | Hámark er 5, en hetjur ná level 10. Fyrir level 6–10 velur Gauss-dreifingin alltaf efstu stig, og fullt XP fæst óháð mun á level. | Skrá sem opna ákvörðun. |

---

## 6. Samanburður á reglum og útfærslu

| Regla | Heimild | Útfærsla | Mat |
|---|---|---|---|
| Fighter Weapon Training (+1/+1 L5, +2/+2 L9, öll vopn) | pre-merge-audit §4.1 | `rules.js` L89–94; `combat/rules.js` L49–52, L173–175 | ✅ Samræmist |
| Fighter Armor Training (+1 Max DEX L3, +2 L7) | sama | `rules.js` L102–107; `combat/rules.js` L122–127 | ✅ |
| Ranger Favored Enemy (+1/+2/+3, aldrei Undead, Humanoid þarf undirtegund) | sama | `rules.js` L116–146 | ✅ (öll 14 viðmótsval passa við DB-undirtegundir, R15) — L6 |
| Ranger Opening Shot (5 skilyrði, einu sinni) | balance-report §1.2 | `combat/engine.js` L109–195 | ✅ vélrænt — ❌ ekki sýnt við dráp (H3); persistent alltaf „spotted“ (M8) |
| Cleric Holy Radiance (+2/+3/+2 … +4/+5/+4 vs Undead) | pre-merge-audit §4.1 | `rules.js` L155–193 | ✅ |
| Cleric Self-Healing (1d6×2 … 5d6×4, endurhleðst í borg) | sama | `rules.js` L205–285 | ✅ — L3 |
| XP (PF Fast) og level-up (+HP, engin full lækning) | sama §4.4 | `rules.js` L7–55; `persistence.js` L262–286 | ✅ |
| Equipment / Primary Weapon / fallback | sama §4.2 | domain ✅ | ❌ **Viðmót brotið (C1)**, rangt AC í viðmóti (M1) |
| Two-Handed / Shield (bónus 0 með 2H melee og ranged) | pre-merge-audit §9.1 | `combat/rules.js` L131–141 | ✅ (athugið að **pre-merge-audit §6.3 L233 segir hið gagnstæða**, sjá kafla 8) |
| Unlimited Ammunition | pathfinder-rules-mapping | engin ammo-talning | ✅ |
| Healing Potion Selection (ódýrastur sjálfgefinn, eignarhald) | pre-merge-audit §9.2 | `combat/engine.js` L445–516 | ✅ — L4 |
| Þrjár bardagaaðgerðir | combat-system-plan §2.A | Attack/Potion/Flee **+ Ignore + Conclude** | ❌ **C2** |
| Initiative `1d20+bonus`, jafntefli til hetju | combat-system-plan §2.C | auk falinnar reglu | ❌ **H4** |
| City Safety (CR ⅓ / ½ / 1 eftir fjarlægð, BFS) | balance-report, pre-merge-audit §4.6 | `encounters/engine.js` L18–27; `map.js` L202–258 | ✅ samkvæmt reglu — M4 |
| Gauss-dreifing (σ 1,5 eftir `solo_level`, svo `spawn_weight`) | README, GAME_SPEC | `encounters/engine.js` L33–144 | ✅ |
| Loot (treasure tables, dýr ekkert, magic % eftir CR) | overnight-development Phase I | `loot.js` | ✅ töflur — M5 (venjulegir hlutir ekki CR-kvarðaðir) |
| Permadeath (50% gull, 50% hlutir, 20 hámark, +10% HP einu sinni) | combat-system-plan §2.F–G, §6 | `persistence.js` L22–198 | ✅ útreikningar |
| Persistent: fullt HP í hverjum bardaga | combat-system-plan L88, L226 | — | ❌ **H2** |
| Persistent: samtímavörn (B fær ekkert) | combat-system-plan §7.4 | — | ❌ **H1** |
| Shared Magical Market (40% / 125%, eitt eintak) | pre-merge-audit §4.5 | `shop.js` L74–121, L188–218 | ✅ (töfradrykkir fara ekki á markað: **NOT VERIFIED** gagnvart ásetningi) |
| City healing ókeypis, læst í bardaga | pre-merge-audit §9 | `rules.js` L290–317; `routes/game.js` L358–376 | ✅ (en C3 skilur hetjur eftir `IN_COMBAT` í borg) |
| Upphafsbúnaður | **Ósamræmi:** combat-system-plan §2.B (Fighter: Longsword+Chain Shirt; Ranger: Shortbow+Leather) vs pre-merge-audit §4.1 | `rules.js` L490–530: Fighter Longsword/Shortbow/Chain Shirt/Light Steel Shield; Ranger Shortsword/**Longbow**/Leather; Cleric Heavy Mace/Sling/Scale Mail/Light Steel Shield; 2 drykkir | Framkvæmt = kóðinn (R14). Skjöl ósamræmd. |

---

## 7. Mat á gæðum prófa

**Heildarmat:** Prófin eru mörg og domain-prófin (d20, flokkar, loot-töflur, permadeath-reikningar) eru að mestu góð. En svítan prófar **eigin forsendur** frekar en raunverulega notendaleið, og nokkur próf **vernda villur**.

| Vandamál | Dæmi | Afleiðing |
|---|---|---|
| Próf nota lifandi gagnagrunn | `http_integration.test.js` L11–14; `pre_merge_fixes.test.js` L29–32 | C3 |
| Óákveðið próf (raunverulegt RNG, CR 3 skrímsli í borg) | `pre_merge_fixes.test.js` L577–617 | H5 |
| Próf verndar villu | `encounter_stealth_reveal.test.js` L143–155 krefst þess að Conclude í `IN_COMBAT` opni hreyfingu | C2 fór framhjá |
| Mock-gögn passa ekki við schema | `combat_balance_updates.test.js` L82, L96, L110: `{ is_flying: 1, creature_type: 'BEAST' }`. Schema notar `movement_type='FLY'` og engin `BEAST`-tegund er til | M1 fór framhjá (raunveruleg encounter-röð vantar `movement_type`) |
| Ólöglegt ástand í fixtures | `INSERT INTO encounters … tile_id = 1` / `hero.tile_id` (borg) í `overnight_systems.test.js` L220–224 og `pre_merge_fixes.test.js` | Bardagi á öruggum reit |
| Framleiðsluleið aldrei prófuð | Öll initiative-próf senda inn `rng`. `overnight_systems.test.js` L227 kallar án `rng` en athugar aðeins vopn | H4 |
| HTTP-próf athuga tilvist strengja, ekki virkni | `encounter_stealth_reveal.test.js` L92, L144: `html.includes('/game/encounter/ignore')` | C1 (form birtist en virkar ekki) |
| Skráartilvistarpróf | `monster_expansion_30.test.js` L115–146; `new_monsters.test.js` L105–106 | Réttmæt fyrir eignir en prófa enga hegðun |
| Framleiðslukóði beygður að prófum | Ofhlaðnar undirskriftir í `calculateHeroAC` og `getClericHolyRadianceBonus`; `is_flying`; `rollDie` samþykkir heiltölur úr rng | Flækjustig; dulur villuflötur |
| Innflutt fall er ekki til | `pre_merge_fixes.test.js` L11 `getCharacterById` (undefined) | Snyrting |

**Próf sem vantar (forgangsraðað):**
1. HTTP: lesa **birt** form og senda þau óbreytt (equip, unequip, sell, buy, potion, flee).
2. HTTP: Ignore/Conclude í `IN_COMBAT` skal hafnað.
3. Fjölnotendapróf: tvær hetjur gegn sömu persistent instance (H1).
4. Persistent monster: fullt HP eftir flótta (H2).
5. Sigur → birting loot, XP og level-up (H3).
6. Initiative í gegnum `investigateEncounter` án innsprautaðs RNG (H4).
7. Guard: próf mega aldrei opna `data/darkgrid.sqlite` (C3).
8. Viðmót vs vél: AC og virkt vopn gegn FLY og Undead (M1).
9. Narrative með raunverulegum encounter-röðum (M2).
10. Þjónustuhöfnun á Cleric heal við fullt HP (L3).

---

## 8. Ósamræmi í skjölum og fyrri úttekt

| Fullyrðing í `docs/pre-merge-audit.md` | Raunveruleiki |
|---|---|
| „101 af 101 prófum standast“ (L29, L188, L370) | 100/101 í einangruðum gagnagrunni; próf 6 fellur í ~43% keyrslna (H5) |
| Lifandi gagnagrunnur „heill, engir orfanar“ (L20, L86) | ~97% notenda eru prófunarnotendur; 4 hetjur fastar í bardaga í borg (C3) |
| „3 löglegar bardagaaðgerðir“ (L22, L134) | Ignore og Conclude virka í bardaga (C2) |
| „Inventory/búnaður 100% samþætt“ (L220) | Equip/Unequip í viðmóti virkar ekki (C1) |
| §6.3 L233: 2H melee **heldur** skjaldarbónus | §9.1 L330–349 og kóðinn: bónus **fellur niður**. Skjalið er í mótsögn við sjálft sig |
| §8 L287: „Engin CSRF-tákn … sameSite ekki stillt“ | §9 og kóðinn: CSRF og `sameSite:'lax'` eru virk. Taflan er úrelt |
| Commit `0b80b34` (L54) | Raunverulegur HEAD er `2691249`; commit var endurskrifað eftir úttekt |
| Scratch-skriftur (`audit_e2e_gameplay.js` o.fl., L194–201) | Ekki í repo — **NOT VERIFIED** |
| combat-system-plan §2.B upphafsbúnaður | Kóði og pre-merge-audit nota annan búnað (sjá kafla 6) |
| `README.md` „Phase 1“, „Investigate … Phase 1 staðgengill“ | Úrelt; bardagi og Phase 2–3 eru útfærð |

---

## 9. Öryggisúttekt — samantekt

| Svið | Mat | Athugasemd |
|---|---|---|
| SQL injection | ✅ Öruggt | Öll SQL notar `prepare(?)`. Eina strengjasamlagningin er innri `SAVEPOINT tx_N` |
| XSS | ✅ Öruggt | Allt notandaefni er birt með `<%= %>`. `<%-` er aðeins notað fyrir includes og fasta JSON-stillingu |
| CSRF | ✅ Virkt | Synchronizer token og `timingSafeEqual`. GET `/logout` er undantekning (M3) |
| Authorization / eignarhald | ✅ | Allar leiðir sækja hetju út frá `req.user.id`, og hlutir eru staðfestir með `owner_character_id` |
| Gull / XP / hlutir með ólöglegum beiðnum | ❌ | Gull og XP tvöfaldast (H1); bardaga sleppt án áhættu (C2); ótakmarkaðar Club-raðir (M6) |
| HP með ólöglegum beiðnum | ⚠️ | Engin bein HP-svik. Í gegnum C2 + ókeypis borgarhvíld er hægt að forðast dauða kerfisbundið |
| Concurrency | ⚠️ | `DatabaseSync` keyrir samstillt, svo engin raunveruleg kapphlaup eru innan eins ferlis. Rökleg fjölnotendavilla er til staðar (H1). MemoryStore styður ekki fleiri ferla |
| Sessions | ⚠️ | M3 |

---

## 10. Atriði sem ekki var hægt að sannreyna (NOT VERIFIED)

- Hvort töfradrykkir eigi að fara á Global Magical Market (skjöl þögul).
- Hvort val á venjulegu loot eigi að vera CR-kvarðað (skjöl þögul).
- Fyrri scratch-skriftur úttektar (ekki í repo).
- Hegðun undir fleiri Node-ferlum eða álagi (ekki prófað).
- Myndgæði og listrænt samræmi skrímslamynda (utan umfangs; aðeins tilvist athuguð).
- Hvort hrein uppsetning (`npm run setup:db`) á **tómum** `data/` skili sama ástandi og lifandi gagnagrunnurinn (ekki keyrt, til að forðast að snerta `data/`).

---

## 11. Ráðlögð röð lagfæringa

1. **C1** (2 línur í `game.ejs`) og próf.
2. **C2** (takmarka status í 2 föllum, fjarlægja falið form) og leiðrétta próf.
3. **C3** (próf á `:memory:`), síðan hreinsun lifandi gagnagrunns **með samþykki eiganda**.
4. **H3** (birta niðurstöðu bardaga).
5. **H1 / H2** (staða og HP persistent monster).
6. **H4** (fjarlægja eða skjalfesta initiative-reglu).
7. **H5** (ákveðin HTTP-próf).
8. MEDIUM eftir þörf. Ákveða M4 og M5 sem hönnunarákvarðanir í `OPEN_DECISIONS.md`.

> [!IMPORTANT]
> **Lokamat: NOT READY FOR PLAYTESTING.**
> Eftir C1–C3 og H1–H5, ásamt prófum, er gert ráð fyrir **READY WITH WARNINGS** (eftirstandandi: M1–M8 og LOW).
