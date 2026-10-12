# DARKGRID — Verkáætlun fyrir coding agent

**Markmið:** Komast hratt í **fyrsta spilanlega vefskjá** og stækka leikinn í öruggum, prófanlegum einingum. Halda höfundinum við efnið og sýna raunverulegt útlit snemma.

**Aðalskjal:** `DARKGRID_GAME_SPEC.md` er heimild fyrir kröfum, tillögum og óákveðnum atriðum. `schema_draft.sql` og `seed_assassin_vine.sql` eru hjálpargögn, ekki krafa um nákvæmlega þá útfærslu.

## Fyrir upphaf

1. Athuga hvort repo sé þegar til. **Ekki yfirskrifa** eða breyta núverandi tækni án skýrrar ástæðu.
2. Ef repo er tómt: mælt með **Node.js + Express + SQLite + server-rendered HTML/EJS + CSS + smá vanilla JavaScript**. Engin þörf á flóknu frontend frameworki í fyrstu.
3. Búa til `README.md`, `.env.example`, `.gitignore`, `src/`, `public/`, `data/` (SQLite skrár ekki committaðar), `db/migrations/`, `db/seeds/`, `tests/`.
4. Stillanleg game-constants á einum stað (`encounterChancePercent=25`, `encounterSigma=1.5`); ekki dreifa óstaðfestum gildum um kóðann.
5. Undirbúa migrations og seed-runner þannig að uppsetning sé endurtekningarhæf.
6. Skrá hvert útkljáð svið í README og halda `OPEN_DECISIONS.md` uppfærðu.

## Phase 1 — Fyrsti sýnilegi leikurinn (**gera þetta fyrst**)

**Afhenda eitt virkt ferðaflæði**:

- Register/Login með öruggum lykilorðahöshum og server-side session.
- Notandi án lifandi hetju fer í Character Creation; notandi með lifandi hetju beint á leikskjá.
- Fighter/Ranger/Cleric, grunnstats og punktaúthlutun með staðfestingu á server.
- Seed-map (t.d. **15×15 sem tímabundið sýnishorn**, ekki fastur heimsmælikvarði), með að minnsta kosti Forest, Swamp, Plains og öruggri City.
- Aðalskjár: stóra svæðisnafnið, 5×5 lítið kort, staðarlýsing, mögulegar aðgerðir, N/S/A/V, Character/Inventory/Equipment sem einfaldir flipar.
- Hreyfing til gilt nágrannareits skrifar staðsetningu í SQLite; endurhleðsla heldur henni.
- Server framkvæmir 25% encounter-kast **einu sinni fyrir gilt ferðaskref**, ef engin persistent monster er á reit.
- Random encounter valið samkvæmt level-normalvægi og habitat, með einangruðum engine-function og prófi. **Ekki gleyma terrain-vörpun:** `FOREST → F`, `JUNGLE → J`, `SWAMP → S` (aðrir kóðar ákveðnir síðar).
- Birta `1_distant` eða `2_ranger_distant`; **Investigate** birtir `3_close`/`4_ranger_close` og getur í Phase 1 sýnt staðgengil fyrir bardaga; **Ignore** lokar encounter og opnar ferð.
- Seed-eintak Assassin Vine með öllum níu lýsingum. Setja jafnframt fáeinar **merktar development-placeholder tegundir** á levelum 1–3 til að prófa normalval; ekki láta sem þetta séu staðfest Pathfinder-gögn.

**Skilgreining á „búið“:** Hægt er að skrá sig, búa til löglega hetju, sjá flottan skjá, ferðast og fá réttlýst encounter án þess að endurhlaða og breyta niðurstöðunni. Ranger sér aðra lýsingu. Client getur ekki valið skrímsli eða tekið handahófsákvarðanir fyrir server.

**Tæknileg undirpróf:**
- Ólögleg punktadreifing (yfir 18 eða undir base-2) hafnað.
- Tvær lifandi hetjur á sama account hafnað, einnig við tvöfaldan concurrent request.
- Reitur utan korts / ófær reitur hafnað.
- Page refresh breytir ekki pending encounter.
- Terrain filter velur aldrei rangt habitat.
- Prófun með föstu random-seed sýnir topp við hero level og fallandi líkur með fjarlægð frá því.

## Phase 2 & 3 — Bardagakerfi, Permadeath og Persistent Monsters

> **Sjá nákvæma hönnunarforskrift og verkþáttaskipta áætlun í [`docs/combat-system-plan.md`](../../docs/combat-system-plan.md).**

### Lykilatriði í Phase 2 & 3:
- **Þrjár löglegar aðgerðir spilara:** `Attack`, `Drink Potion`, `Flee`.
- **Frumkvæði (Initiative):** Kastað við upphaf bardaga (`1d20 + initiative_bonus`). Hærra gildi framkvæmir á undan í umferðum. Jafntefli fellur hetju í hag.
- **Árás og skaði:**
  - `d20 + attack_bonus >= armor_class`.
  - Natural 20 = Critical Hit (2x skaði).
  - Natural 1 = Automatic Miss.
  - Hetju attack bonus: `floor((STR_modifier + DEX_modifier) / 2)`.
  - Hetju AC: `10 + DEX_modifier + armor_bonus + shield_bonus`.
- **Faldar tölur & textalýsingar:** Spilarinn sér eigið HP og potions, en óvinatölur eru 100% faldar.
- **Níu ástandslýsingar skrímsla:** `5_health_100` til `9_dead` birtast aðeins þegar heilsufarsflokkur lækkar, aldrei endurteknar í hverri umferð.
- **Flótti (Flee):** Skrímsli fær nákvæmlega eina fría árás (Attack of Opportunity). Ef spilari lifir af tekst flótti. Fær ekki tvær árásir.
- **Permadeath:** HP = 0 veldur endanlegum dauða. Aðgerðir læstar á server-stigi.
- **Persistent Monsters:**
  - Aðeins skrímsli sem drepa spilara festast á reitnum í `monster_instances`.
  - Fá +10% max HP boost einu sinni (`Math.ceil(base_hp * 1.10)`).
  - Byrja hvern nýjan bardaga með fullt HP miðað við styrkt hámark í v1.
  - Varðveita 50% gulls og 50% hluta (hámark 20 hluti, forgangsraðað eftir töframætti og verðmæti). Afgangur eyðileggst.
  - Þegar annar spilari heimsækir reitinn mætir hann þessu skrímsli; random encounter kerfið er óvirkt á meðan.
  - Sigurvegari fær XP, gull og varðveitt loot; skrímsli fær stöðuna `DEFEATED` og reitur losnar.
  - Allt framkvæmt í atómum færslum (`withTransaction`) til að koma í veg fyrir tvöföldun á loot eða kapphlaup.

**Skilgreining á „búið“:** Hero getur barist turn-by-turn við skrímsli með Attack, Potion og Flee, sér aðeins texta og eigið HP. Dauði veldur permadeath og býr til persistent monster með réttu loot og +10% HP boost. Sigur fellir skrímslið og losar reitinn. Öll 17 prófin í prófunaráætlun standast.

## Phase 4 — Borgir, búnaður og sameiginleg verslun

- Ein upphafsborg, healing með gjaldi og venjulegar vörur úr sama katalogi sem gildir í öllum borgum.
- Inventories og equip slots, aðeins leyfilegt gear samkvæmt class.
- Stofna unique `item_instances` fyrir magical items.
- Sell magical item → atomic eigendaflutningur `CHARACTER → MARKET` + eitt active listing.
- Buy magical item → atomic gold-debit, listing verður SOLD, item skiptir um eiganda.
- Aðeins ein samtímis kaupbeiðni getur unnið. Endurtekning beiðni má ekki búa til fleiri hluti eða gull.

**Skilgreining á „búið“:** A selur einstakt magical item; B og C sjá það í öllum borgum; aðeins einn getur keypt; vara hverfur hjá hinum.

## Phase 5 — Jafnvægi og meira efni

- Meta `solo_level` fyrir skrímsli með simulated fights á mismunandi levels og classum.
- Bæta Pathfinder-hæfileikum í einfaldri leikvænni útfærslu; ekki herma allar reglur.
- Hækka monster-fjölda, bæta terrain, fleiri borgum, loot tables, XP progression og réttum class abilities.
- Samræma combat/gear/economy eftir endurgjöf frá eiganda; varanlegar ákvarðanir fara í `OPEN_DECISIONS.md` og síðan Game Spec.
- Prófa multiuser race conditions og hækka álag hægt.

## UI og stíll

- Dökkir bakgrunnir, fölnir græn-/jarðlitir og lítið gullbrúnir áherslupunktar.
- Serif/gothic-tilfinning í svæðisheitum, einfalt meginmál með góðum kontrasti; ekki þurfa sérleyfisskyldar myndir eða fonta.
- Mest áberandi eru **svæðisnafnið, textinn og næsta ákvörðun**; lítill minimap, ekki stórt RPG-spreadsheet.
- Mobile/responsive í eðlilegum grunnstíl.
- Combat/monster health lýst með orðum, ekki sýndur enemy health bar.

## Tæknilegar einingar / ábyrgð

```text
src/
  app / routes / middleware             # Auth, sessions, route validation
  domain/character                       # Classes, stat allocation, character rules
  domain/world                           # Map, terrain, movement
  domain/encounters                      # Spawn chance, weighted normal, pending state
  domain/combat                          # Dice, initiative, attack, damage, text events
  domain/inventory                       # Items, equipment, ownership
  domain/market                          # Shared magical listings, transactions
  domain/monsters                        # Monster catalog and persistent instances
  db                                     # SQLite connection, queries, migrations
  views                                  # Page rendering
public/
  css / js
 db/
  migrations / seeds
 tests/
```

Þetta er leiðbeinandi skipting, ekki skylda um nákvæmar slóðir.

## Samningsskilyrði fyrir alla agent-kóða

1. **Aldrei** henda gögnum eða dropa gagnagrunn án skýrs samþykkis.
2. Haltu við öllum núverandi gagnagrunnsskrám og afhentu migrations.
3. Lykilorð og öryggislyklar ekki í source eða Git.
4. Ekki láta frontend reikna ákvarðanir um loot, combat, XP, dauða eða kaup.
5. Nota transaction við eignatilfærslur og vernda gegn endurteknum beiðnum.
6. Allar leikreglur sem eru merktar [TILLAGA] skulu vera auðbreytanlegar; [ÓÁKVEÐIÐ] skulu skráð, ekki falin.
7. Skrá build/run/test skipanir og keyra sjálfvirk próf eftir hverja áfanga.
8. Koma með **skjá sem er hægt að opna og prófa eftir Phase 1**, áður en Phase 2 hefst.

## Gátlisti við afhendingu fyrstu sýnilegu útgáfu

- [ ] `npm install` / `npm run dev` (eða skýrar jafngildar skipanir) virkar.
- [ ] `npm test` fer í gegn.
- [ ] Register/Login og session virka.
- [ ] Fighter, Ranger, Cleric og punktaúthlutun virka.
- [ ] Engin önnur lifandi hetja getur verið stofnuð samtímis.
- [ ] Kort og allar 4 áttir eru sýnileg og gögnin persist.
- [ ] Random encounter og terrain/normal-weighting virka.
- [ ] Nine descriptions eru valid í SQLite og Ranger fær rétta lýsingu.
- [ ] Pending encounter lifir refresh.
- [ ] Screenshot eða raunveruleg staðbundin keyrsluleið fylgir með.
- [ ] Agent skilar stuttri samantekt: hvað er virkt, hvað er mock og hvaða ákvarðanir bíða eiganda.
