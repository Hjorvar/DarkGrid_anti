# Darkgrid Action UI Lab — Framkvæmda- og prófunarskýrsla (`action-ui-lab/`)

**Dagsetning:** 20. október 2026  
**Umfang:** Eingöngu sjálfstæða tilraunaútgáfan `action-ui-lab/` (100% einangruð frá aðalleiknum).  
**Viðmið:** *Dungeon Master* / *Legend of Grimrock* fyrstu persónu reitaleikur með stórum leikglugga, sjálfstæðri sjónstefnu, kortatengdu útsýni, ógn inni í senunni, lotubundnum bardagatakti (~380 ms milli atburða) og áframhaldi eftir sigur án óþarfa staðfestingar.

---

## 1. Hvað var útfært

### 1.1 Sjálfstæð sjónstefna og fyrstu persónu hreyfing (`server.js` + `action-ui.js`)
- **Sjónstefna í gagnagrunni:** Bætt var við dálkinum `facing TEXT NOT NULL DEFAULT 'NORTH'` (ásamt `pending_victory_encounter_id INTEGER DEFAULT NULL`) á `characters` töfluna í staðbundna prófunargagnagrunninum `action-ui-lab/data/action_lab.sqlite`.
- **Snúningur (`TURN`):** Aðgerðin `TURN` (`LEFT` / `RIGHT` eða bein stefna `NORTH | EAST | SOUTH | WEST`) snýr hetjunni um 90° á sama reit án þess að kveikja á nýjum encounter, án þess að endurkasta núverandi `DISCOVERED` eða `IN_COMBAT` encounter og án þess að gefa ókeypis bardagaumferð.
- **Afstæð hreyfing (`MOVE`):** Hreyfing styður nú bæði afstæðar skipanir miðað við sjónstefnu (`FORWARD`, `BACKWARD`, `STRAFE_LEFT`, `STRAFE_RIGHT`) og höfuðáttir (`NORTH`, `EAST`, `SOUTH`, `WEST`, t.d. þegar smellt er á aðliggjandi reit á minimap).
- **Áttaviti og 5×5 Minimap:** Minimap heldur norðri alltaf efst (`North ▲`), en ör hetjunnar á miðjureitnum (`▲ / ▶ / ▼ / ◀`) snýst í samræmi við sjónstefnu og reiturinn beint fram undan (`ahead1`) fær gullna sjónsviðsáherslu (`is-fov-ahead`). Við hlið minimap er sérstakur *Compass Rose* hringur sem sýnir sjónstefnu og hvaða reitur er fram undan.

### 1.2 Kortatengt útsýni og stefnubundin hreyfibirting (`buildViewportScene` + `renderViewportScene`)
- **Fjöllaga kortatengd sena:** Í stað þess að hrista aðeins eina fasta bakgrunnsmynd reiknar `buildViewportScene` í `server.js` staðfræði í kringum hetjuna miðað við núverandi reit og sjónstefnu (`current`, `ahead1`, `ahead2`, `left1`, `right1`, `aheadLeft`, `aheadRight`, `behind1`).
- **Stöðugt hnitabundið seed án speglunar:** Fallið `computeTileFacingSeed(x, y, facing)` býr til ákvarðanabundið (deterministic) seed fyrir hvern `(x, y, facing)` punkt. Það stýrir:
  - Hóflegri hliðrun á `object-position` (`42%–58%`) og birtustigi grunnmyndar (aldrei er notað `scaleX(-1)` sem myndi spegla kennileiti á ósamkvæman hátt).
  - *Forward Horizon Portal* (`#fp-ahead-portal`) sem sýnir terrain-skipti eða kennileiti fram undan (t.d. borgarhlið, steinbrú, rústir eða fjallgarð).
  - Hliðarveggjum/opum (`#fp-flank-left`, `#fp-flank-right`) eftir því hvort reitir til vinstri/hægri eru færir eða ófærir.
  - Kortatengdu SVG-lagi (`#fp-scene-svg-wrap`) sem teiknar perspektíf-stíg/veg þegar leiðin fram undan er greið, hliðarstíga til vinstri/hægri þegar þær áttir eru færar, en skýra sjónræna hindrun (klettavegg, beljandi á eða ófæra mýri) þegar `ahead1.isPassable === false`.
- **Stefnubundin hreyfiáhrif:** Stuttar (~220–240 ms) hreyfimyndir fyrir skref áfram (`.anim-step-forward`), skref aftur á bak (`.anim-step-backward`), hliðarskref (`.anim-strafe-left` / `.anim-strafe-right`), 90° snúning (`.anim-turn-left` / `.anim-turn-right`) og högg á fyrirstöðu (`.anim-blocked-bump`). Allar hreyfimyndir virða `@media (prefers-reduced-motion: reduce)`.

### 1.3 Ógnir inni í senunni (`DISCOVERED`) og 1-skrefs framhjáganga
- **Skuggi í þoku í stað miðjuspjalds:** Á `DISCOVERED` stigi birtist ógnin sem óljós, almennur skuggi í þokunni (`.fp-inscene-threat` og `.fp-shadow-apparition`) á stígnum fram undan ásamt lágstemmdri lýsingarplötu neðst í senunni.
- **Ströng leynd (Encounter Secrecy):** Engin skrímslamynd, ekkert nafn, ekkert tákn og engar tölur eru sendar í `buildClientState` á `DISCOVERED` stigi — aðeins skynjunarvísbendingin á ensku (`resolvedDescription`).
- **Tafarlaus virkjun eða 1-skrefs framhjáganga:**
  - Smellur á skuggann eða `Space / 1` virkjar *Engage Threat* (`INVESTIGATE`).
  - Ef ekki er um fyrirsát (`isAmbush`) að ræða getur spilarinn einfaldlega gengið í hvaða færa átt sem er (`W / S / Q / E`) og framkvæmir þjónninn þá `ignoreEncounter` + færslu yfir á nýja reitinn í **einni atómískri aðgerð**. Ef reiturinn sem reynt er að ganga á er ófær (hindrun/kortamörk) er hreyfingunni hafnað án þess að eyða `DISCOVERED` encounterinum.
  - Í fyrirsát (`STAGE1_AMBUSH` / `isAmbush === true`) er framhjáganga og hreyfing lokuð þar til tekist er á við ógnina.

### 1.4 Lotubundinn bardagataktur (~380 ms milli atburða)
- **Raðaðir bardagaatburðir (`combatSequence.beats`):** `buildCombatSequence` í `server.js` les nýja `combat_events` úr lotunni í nákvæmri útreikningsröð:
  1. **Aðgerð hetjunnar (`HERO`):** Sverðshögg / örvaskot / drykkur / flóttatilraun.
  2. **Viðbragð eða gagnárás skrímslis (`MONSTER`):** Aðeins ef skrímslið lifði af aðgerð hetjunnar. Dautt skrímsli fær aldrei gagnárás.
  3. **Niðurstaða lotunnar (`OUTCOME`):** Sigur (`VICTORY`), fall hetju (`DEFEAT`) eða flótti (`ESCAPED`).
- **Skýr endurgjöf án falskra „Blocked“ skilaboða:** Venjuleg geigun (bæði hjá hetju og skrímsli) birtist sem `Miss` (`pop-miss`), aldrei sem falskt `Blocked`. Högg sýna `⚔️ Hit!` eða `💥 Critical Hit!`, og skrímslið hliðrar sér (`.anim-monster-dodge`) við geigun en hristist (`.anim-monster-hit`) við högg.
- **Samstillt HP- og ástandsuppfærsla:** Lífsþolssúla hetjunnar (`heroHpAfterBeat`) og ástandslýsing skrímslis (`conditionTextAfterBeat`) uppfærast í takti við hvert sýnt beat (~380 ms bil).
- **Vörn gegn tvöföldum árásum og rofnum hreyfimyndum:** Allar bardagaaðgerðir senda `expectedRound` til þjónsins svo hröð lyklaborðsinntök geta aldrei tvöfaldað umferð. Ef spilari grípur inn í eða endurhleður síðuna á miðri hreyfimynd hreinsar `cancelActiveCombatSequence()` alla teljara og birtir rétta, sannreynda stöðu frá þjóni.

### 1.5 Áframhald eftir sigur án staðfestingarhnapps
- **Enginn „Continue Exploring“ lás:** Eftir sigur birtist siguryfirlit með `+XP`, `+Gold` og herfangi í senunni (`pending_victory_encounter_id`), en allar leyfilegar hreyfingar (`W / S / Q / E`) eru strax virkar.
- **1-skrefs áframhald:** Um leið og spilarinn ýtir á t.d. `W` til að halda áfram lokast sigurbirtingin og hetjan færist yfir á næsta reit í sömu aðgerð. Verðlaun eru veitt nákvæmlega einu sinni í gagnagrunninum við uppgjör bardagans og tapast hvorki né tvöfaldast við endurhleðslu eða hreyfingu.

### 1.6 Hreinsað og samræmt stjórnborð
- **Engar tvítekningar:** Fjarlægðir voru tvíteknir hnappar fyrir *Stance*, *Rest*, *Hero* og *Pack* sem áður voru bæði í efri stiku og í hornum 3×3 hreyfispjaldsins.
- **Skýr verkaskipting í hægri dálki:**
  1. **5×5 Tactical Minimap + Compass Rose** efst.
  2. **4-dálka Tactical Action Deck** í miðju (`[SPC/1]` Strike/Engage/Rest, `[2]` Drink Potion, `[3/R]` Swap Stance, `[4/F]` Flee/Slip Past/Divine Heal).
  3. **3×3 First-Person Navigation Pad** (`[A]` Turn Left, `[W]` Forward, `[D]` Turn Right, `[Q]` Strafe Left, Facing Center, `[E]` Strafe Right, `[S]` Back) ásamt einni 4-hnappa upplýsingaröð neðst (`Hero [C]`, `Pack [B]`, `Market [M]`, `Board [J]`).
- **Handahólf (Right Hand / Left Hand):** Sýna réttan útbúnað og virkja aðeins útfærðar aðgerðir (smellur á aðalhönd í bardaga gerir árás; smellur utan bardaga opnar bakpoka eða skiptir um vopnastöðu).

---

## 2. Endanlegar stýringar

| Lykill / Hnappur | Hlutverk | Hegðun eftir ástandi |
| :--- | :--- | :--- |
| **`W` / `Up Arrow`** | Ganga áfram (`FORWARD`) | Færir hetjuna um 1 reit í núverandi sjónstefnu. Virkar í könnun, lokar sigurbirtingu + færir í 1 aðgerð, og fer framhjá venjulegri `DISCOVERED` ógn + færir í 1 aðgerð. |
| **`S` / `Down Arrow`** | Bakka (`BACKWARD`) | Færir hetjuna um 1 reit öfugt við sjónstefnu (sömu reglur og `W`). |
| **`A` / `Left Arrow`** | Snúa 90° til vinstri (`TURN LEFT`) | Snýr sjónstefnu hetjunnar 90° rangsælis án þess að skipta um reit eða kveikja á encounter. |
| **`D` / `Right Arrow`** | Snúa 90° til hægri (`TURN RIGHT`) | Snýr sjónstefnu hetjunnar 90° réttsælis án þess að skipta um reit eða kveikja á encounter. |
| **`Q`** | Hliðarskref til vinstri (`STRAFE_LEFT`) | Færir hetjuna 1 reit til vinstri miðað við sjónstefnu (sömu reglur og `W`). |
| **`E`** | Hliðarskref til hægri (`STRAFE_RIGHT`) | Færir hetjuna 1 reit til hægri miðað við sjónstefnu (sömu reglur og `W`). |
| **`Space` / `1`** | Aðalaðgerð (Slot 1) | *Strike* í bardaga (`IN_COMBAT`), *Engage Threat* á `DISCOVERED`, *Sanctuary Rest* í Oakhaven (`CITY`). |
| **`2`** | Drekka drykk (Slot 2) | Drekka *Minor Healing Potion* í bardaga eða utan bardaga þegar HP vantar. |
| **`3` / `R`** | Vopnastaða (Slot 3) | *Swap Stance* milli `MELEE` og `RANGED` utan bardaga (læst í virkum encounter). |
| **`4` / `F`** | Undanhald / Bæn (Slot 4) | *Slip Past* á `DISCOVERED`, *Flee Battle* (með staðfestingu) í `IN_COMBAT`, eða *Divine Heal* fyrir Cleric utan bardaga. |
| **`C` / `B` / `M` / `J`** | Gluggar (Drawers) | `C`: Hero Sheet, `B`: Pack/Equipment, `M`: Market, `J`: Watcher's Board. |
| **`Escape`** | Loka glugga | Lokar opnum modal-glugga. |

> [!NOTE]
> Allir lyklaborðsflýtihnappar eru sjálfkrafa óvirkir ef fókus er í innsláttarreit (`input`, `textarea`, `select`) eða ef modal-gluggi er opinn (nema `Escape` sem lokar glugganum).

---

## 3. Hvernig sjónstefna og útsýni tengjast kortinu

Til að hægt sé að prófa fjölbreytt landslag, greiðar leiðir, brú, rústir og ófærar hindranir innan 1–2 skrefa frá upphafsreit var staðbundna prófunarkortið í `action-ui-lab/data/action_lab.sqlite` auðgað í kringum Oakhaven `(7, 7)`:

- **`(7, 7)` Oakhaven (`CITY`, öruggur reitur):**
  - Horft **North** (`▲`): Sést út um *Oakhaven North Gate* `(7, 6)`.
  - Horft **East** (`▶`): Sést út á *The Old Stone Bridge* `(8, 7)`.
  - Horft **West** (`◀`): Sést út á *Verdant Plains* `(6, 7)`.
- **`(7, 5)` Mirkwood Crossroads (`FOREST`, 2 skref norður af Oakhaven):**
  - Horft **North** (`▲`): Greið skógarleið dýpra inn í *Mirkwood Forest* `(7, 4)`.
  - Horft **West** (`◀`): Ófær klettaveggur — **Stonefang Crag** `(6, 5)` (`MOUNTAINS`, `is_passable = 0`). Í leikglugganum birtist skýr klettafyrirstaða yfir stígnum (`⛰️ BLOCKED AHEAD: Stonefang Crag`) í stað opinnar leiðar.
  - Horft **South** (`▼`): Horft til baka að *Oakhaven North Gate* `(7, 6)` (`HIGH_ROAD` terrain-skipti í sjóndeildarhring).
- **`(8, 7)` The Old Stone Bridge (`HIGH_ROAD`, 1 skref austur af Oakhaven):**
  - Horft **East** (`▶`): Steinbrú með brúarhandriðum sem liggur yfir að **Bridge East Watchpost** `(9, 7)` (`UNDERGROUND_RUINS`). Til vinstri (norður, `8, 6`) og hægri (suður, `8, 8`) rennur ófær **Blackwater River** (`RIVER_LAKE`, `is_passable = 0`) sem birtist sem vatnsbakkar á hliðum senunnar og sem vatnshindrun (`🌊 BLOCKED AHEAD: Blackwater River`) ef hetjan snýr sér í norður eða suður á brúnni.

---

## 4. Prófanir og niðurstöður

### 4.1 Sjálfvirk prófunarsvíta (`action-ui-lab/tests/action-lab.test.js`)
Keyrð voru **10 sjálfvirk integration-próf** gegnum `node --test action-ui-lab/tests/action-lab.test.js` á einangruðum prófunargagnagrunni innan `action-ui-lab/data/`:

1. **Upphafsstaða, 4 sjónstefnur og endurhleðsla:** Staðfestir að hetjan byrjar í `(7,7)` með `facing = 'NORTH'`, að 90° snúningar (`LEFT`/`RIGHT`) uppfæra `ahead1`/`left1`/`right1` rétt, og að sjónstefna varðveitist við `GET /api/state`.
2. **Afstæðar hreyfingar (`FORWARD`, `BACKWARD`, `STRAFE_LEFT`, `STRAFE_RIGHT`):** Staðfestir rétta hnitafærslu fyrir ólíkar sjónstefnur.
3. **Kortatengt `viewportScene` og hindranir:** Staðfestir að `Stonefang Crag` `(6,5)` birtist sem `isAheadBlocked: true` þegar horft er í vestur frá `(7,5)`, að tilraun til að ganga áfram inn í klettinn skilar `BLOCKED_MOVE` og heldur hetjunni á `(7,5)`, og að `computeTileFacingSeed` skilar nákvæmlega sama seed þegar snúið er aftur í sömu átt á sama reit.
4. **`DISCOVERED` leynd, snúningur án endurkasts og 1-skrefs framhjáganga:** Staðfestir að `DISCOVERED` lekur engum skrímslaupplýsingum, að `TURN` á reitnum breytir ekki né eyðir encounterinum, og að `MOVE` (`BACKWARD`) fer framhjá ógninni og færir hetjuna í einni aðgerð (`bypassedPrevious: true`).
5. **Ófær framhjáganga og fyrirsát (`STAGE1_AMBUSH`):** Staðfestir að ef hetja reynir að ganga úr `DISCOVERED` inn í ófæra hindrun (`Stonefang Crag`) eyðist encounterinn ekki, og að `STAGE1_AMBUSH` lokar bæði á `IGNORE` og `MOVE` þar til hetjan gerir `INVESTIGATE`.
6. **Bardagataktur (`combatSequence.beats`), `Miss` og vörn gegn tvíteknu inntaki:** Staðfestir röðina `HERO -> MONSTER`, að geigun birtist sem `'Miss'` (aldrei `'Blocked'`), og að endurtekin `ATTACK` beiðni með eldra `expectedRound` tvöfaldar ekki umferðina.
7. **Dauði skrímslis án gagnárásar og 1-skrefs hreyfing eftir sigur:** Staðfestir að þegar hetjan fellir skrímsli kemur engin `MONSTER_ATTACK` gagnárás á eftir dauðahögginu, að `XP` og `Gold` bætast við nákvæmlega einu sinni, haldast óbreytt við endurhleðslu, og að næsta `MOVE` lokar sigurbirtingunni og færir hetjuna í sömu aðgerð.
8. **Brúarhliðar, rústir og kortamörk (`y = 0`):** Staðfestir vatnshindranir til norðurs/suðurs á `The Old Stone Bridge` `(8,7)`, göngu yfir í `Bridge East Watchpost` `(9,7)` og höfnun við heimsbrún (`WORLD_EDGE`).
9. **Drykkur (`POTION`) og flótti (`FLEE`) í bardaga:** Staðfestir rétta `heroHpAfterBeat` framvindu og `ESCAPED` niðurstöðu.
10. **Viðmótshreinsun í HTML:** Staðfestir að engir tvíteknir hnappar (`btn-top-stance`, `btn-top-rest`, `pad-tl/tr/bl/br`) eru til staðar.

**Niðurstaða:** `10 pass, 0 fail`.

### 4.2 Raunveruleg vafraprófun (Headless Chrome CDP Playtest)
Til viðbótar við einingapróf var keyrð sjálfvirk vafraprófun í Chrome (`1440×900`) sem prófaði lifandi DOM, lyklaborðsviðburði (`W`, `A`, `S`, `D`, `Space`), sjónræna uppsetningu og tók skjáskot af öllum 6 lykilsenum. Engar villur (`0 console errors`) komu fram í keyrslu.

---

## 5. Þekktar takmarkanir og staðbundnar forsendur

1. **Staðbundin fyrirsátarprófun á 1. stigi (`STAGE1_AMBUSH`):** Í lénsrökfræði Darkgrid (`src/domain/encounters/engine.js`) eru hetjur á 1. stigi (Level 1) verndaðar gegn slembnum fyrirsátum (`enforceNoAmbushAtLevel1`). Til að gera kleift að prófa fyrirsátarflæðið hvenær sem er í tilraunaútgáfunni án þess að breyta reglum aðalleiksins vistar `STAGE1_AMBUSH` hnappurinn í Lab-stikunni `{ "labForcedAmbush": true }` í `encounters.combat_state_json` í staðbundna gagnagrunninum.
2. **Miss vs. Blocked:** Þar sem núverandi bardagavél (`src/domain/combat/rules.js`) reiknar eitt `d20 + AB vs AC` kast án sérstaks skjaldar-blokkkasts birtast allar geiganir sem `Miss` (eða `Parried / Turned aside` í frásagnartexta) en aldrei sem falskt `Blocked` sprettigluggi.
3. **2.5D lagskipt framsetning:** Eins og tilgreint var í verkefnislýsingu er notuð létt lagskipt 2.5D framsetning (myndir tilraunaútgáfunnar + sjóndeildargluggi + SVG-perspektíflög og hnitabundið seed) í stað fullrar 3D WebGL vélar.

---

## 6. Skjáskot úr lifandi tilraunaútgáfu

Öll skjáskot voru tekin beint úr keyrandi tilraunaútgáfu í `action-ui-lab/docs/screenshots/`:

1. **Oakhaven Sanctuary (Horft í norður að Oakhaven North Gate):**  
   [`docs/screenshots/01-oakhaven-north.png`](screenshots/01-oakhaven-north.png)
2. **The Old Stone Bridge (Horft í austur að Bridge East Watchpost með Blackwater River á báðar hliðar):**  
   [`docs/screenshots/02-bridge-east-ruins.png`](screenshots/02-bridge-east-ruins.png)
3. **Mirkwood Crossroads (Horft í vestur að ófærum Stonefang Crag klettavegg):**  
   [`docs/screenshots/03-crossroads-west-obstacle.png`](screenshots/03-crossroads-west-obstacle.png)
4. **Stage 1 (`DISCOVERED`) — Óljós ógn inni í þokunni án miðjuspjalds:**  
   [`docs/screenshots/04-stage1-inscene-threat.png`](screenshots/04-stage1-inscene-threat.png)
5. **Stage 2 (`IN_COMBAT`) — Virkur bardagi með lotubundnum takti:**  
   [`docs/screenshots/05-stage2-active-combat.png`](screenshots/05-stage2-active-combat.png)
6. **Siguryfirlit (`VICTORY`) — Tilbúið fyrir tafarlausa áframgöngu með `W/S/Q/E` án staðfestingar:**  
   [`docs/screenshots/06-post-victory-seamless.png`](screenshots/06-post-victory-seamless.png)

---

## 7. Nákvæmar leiðbeiningar til að ræsa og prófa tilraunaútgáfuna

### Ræsing
Keyrðu eftirfarandi skipun úr rót verkefnisins:

```bash
node action-ui-lab/server.js
```

Opnaðu svo í vafra:
- **http://localhost:3030**

*(Ef port 3030 er upptekið má velja annað port með `ACTION_LAB_PORT=3100 node action-ui-lab/server.js`).*

### Prófunarskref í vafra
1. **Sjónstefna og gönguflæði:**
   - Ýttu á **`A`** og **`D`** (eða vinstri/hægri ör) í Oakhaven `[7, 7]` og fylgstu með áttavitanum, örinni á minimap og hvernig útsýnið og *Ahead* lýsingin breytast milli *Oakhaven North Gate* (N), *The Old Stone Bridge* (E) og *Verdant Plains* (W).
   - Snúðu í **East** (`D`) og gakktu áfram (`W`) út á **The Old Stone Bridge** `[8, 7]`. Prófaðu hliðarskref til vinstri (`Q`) út í **Blackwater River** til að sjá höfnunarhreyfingu og skýr skilaboð.
2. **Hindranir í landslagi:**
   - Smelltu á **🌲 Crossroads** í efri Lab-stikunni (flytur hetjuna á `[7, 5]` Facing North).
   - Ýttu á **`A`** til að snúa í **West** (`◀`). Sjáðu hvernig **Stonefang Crag** klettaveggurinn lokar stígnum fram undan. Ýttu á **`W`** til að sannreyna að hetjan kemst ekki í gegnum klettinn.
3. **Ógn inni í senunni (`DISCOVERED`) og 1-skrefs framhjáganga:**
   - Smelltu á **👁️ Stage 1: Threat** í efri Lab-stikunni.
   - Taktu eftir að skugginn birtist inni í skógarsenunni án þess að ljóstra upp tegund skrímslisins.
   - Prófaðu að snúa þér með **`A` / `D`** — ógnin helst óbreytt á reitnum.
   - Ýttu á **`S`** (eða `W`/`E`) til að smeygja þér framhjá ógninni og ganga yfir á næsta reit í **einni aðgerð**.
   - Smelltu á **⚠️ Stage 1: Ambush** og reyndu að ganga í burtu með **`S`** — fyrirsátin kemur í veg fyrir brotthvarf þar til ýtt er á **`Space`** til að mæta ógninni.
4. **Bardagataktur og áframhald eftir sigur:**
   - Smelltu á **⚔️ Ghoul** eða **⚔️ Vine** í efri stikunni og ýttu á **`Space`** (eða smelltu beint á skrímslið) til að gera árás.
   - Fylgstu með ~380 ms taktinum: fyrst högg hetjunnar, svo gagnárás skrímslisins og uppfærsla á HP-súlu.
   - Þegar skrímslið fellur birtist siguryfirlitið — ýttu einfaldlega á **`W`** eða **`S`** til að ganga beint áfram á næsta reit án þess að þurfa að smella á staðfestingarhnapp.

### Keyrsla sjálfvirkra prófa
```bash
node --test action-ui-lab/tests/action-lab.test.js
```
