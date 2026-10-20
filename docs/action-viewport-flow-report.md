# Darkgrid — Greining á flæði og aðlögun að Action Viewport forminu

> **Skjal:** `docs/action-viewport-flow-report.md`  
> **Viðfangsefni:** Rannsókn á `action-ui-lab/` tilraunaútgáfunni og hönnunaráætlun fyrir hraðara, eðlilegra og skemmtilegra leikflæði.  
> **Tungumálaregla:** Skýrsla og hönnun á íslensku; allur texti sem spilarinn sér í leiknum er á **ensku**.

---

## 1. Kjarni málsins: Af hverju líður manni „skrýtið“ við að hreyfa sig?

Nýja hugmyndin í `action-ui-lab/` — að færa Darkgrid yfir í **First-Person Action Viewport** í anda *Dungeon Master* og *Legend of Grimrock* — er sjónrænt mjög sterk. Myndirnar njóta sín miklu betur, viðmótið er þétt og andrúmsloftið er dökkt og flott.

**Ástæðan fyrir því að flæðið (og sérstaklega hreyfingin) virkar skrýtið í dag er sú að við settum *1. persónu hasar-viðmót (Action UI)* ofan á *gamla, hæga 2D-textaleikjavél* án þess að breyta taktinum í hreyfingu, fundum og bardaga.**

Við rannsókn á kóðanum í `action-ui.js`, `action-ui.css` og `server.js` komu í ljós **6 tilteknir flöskuhálsar** sem valda þessari óþægilegu tilfinningu:

---

### 1.1 Sjónarhorns- og áttamisræmi (1. persónu gluggi vs. N/S/A/V kortastefnur)
* **Hvað gerist í kóðanum:** Í `action-ui.css` spilar hvert einasta skref nákvæmlega sömu hreyfimyndina (`fpStepBob`: `scale(1.035) translateY(-9px)`), óháð því í hvaða átt þú ferð.
* **Af hverju það líður skrýtið:** Stóri glugginn segir heilanum að þú horfir *beint fram* með augum hetjunnar. En þegar þú ýtir á **`S` (Suður / niður á minimap)** eða **`A` (Vestur / vinstri)**, þá þysjar myndavélin samt *beint áfram* inn í myndina! Heilinn skynjar ósamræmi milli þess að færa sig *til hliðar / til baka* á 5×5 kortinu hægra megin og þess að hoppa *áfram* í glugganum vinstra megin.

### 1.2 „Veggfóðurs-göngubrettið“ (Sama myndin hristist án breytinga)
* **Hvað gerist í kóðanum:** Í `001_seed_world.sql` og `artwork.js` deila allir 38 reitirnir í *Mirkwood Forest* nákvæmlega sömu myndinni (`terrain_forest.webp`), sama heitinu (`Mirkwood Forest`) og sömu lýsingunni. Í `action-ui.js` er myndinni ekki einu sinni skipt út ef `imageUrl` er það sama.
* **Af hverju það líður skrýtið:** Þegar þú gengur 4–6 skref í röð í gegnum skóg eða mýri breytist **ekkert** á skjánum nema litlir hnitatölustafir (`[X: 6, Y: 4]` -> `[X: 6, Y: 3]`). Sama myndin hoppar bara örlítið upp og niður í 0,4 sekúndur. Spilaranum líður eins og hann sé að ganga á göngubretti fyrir framan veggfóður — það er engin tilfinning fyrir vegalengd eða framvindu.

### 1.3 75% „Tóm skref“ og skyndilegir hemlar (Stop-and-Go Pacing)
* **Hvað gerist í kóðanum:** Í `encounters/engine.js` eru 25% líkur á fundi við hvert skref. Í 75% tilfella gerist ekkert. En um leið og 25% teningurinn hittir á fund, læsir `action-ui.js` (`if (currentState.encounter || currentState.victory) return;`) öllum `W/A/S/D` hreyfitökkum samstundis.
* **Af hverju það líður skrýtið:** Af því að ekkert gerist í 3 af hverjum 4 skrefum venst spilarinn því að ýta hratt á `W -> W -> W` til að komast á milli staða. Svo allt í einu hættir `W` að virka! Þú klessir á ósýnilegan vegg í viðmótinu.

### 1.4 Stig 1 (`DISCOVERED`) rýfur sjónræna flæðið með textakassa
* **Hvað gerist í kóðanum:** Þegar fundur byrjar á Stigi 1 birtist stór dökkur spjaldgluggi (`fp-mystery-actor` í `action-ui.js`) með rúninni `ᚦ` sem hylur miðju landslagsins.
* **Af hverju það líður skrýtið:** Í *First-Person Action* leik viltu **sjá** hættuna birtast í umhverfinu (t.d. skuggamynd eða glóandi augu í þokunni), ekki fá *pop-up* textaspjald sem stoppar leikinn áður en bardaginn byrjar. Og ef þú velur *Bypass & Ignore*, þá siturðu ennþá á sama reit í stað þess að halda áfram göngunni.

### 1.5 „Sigur-stoppið“ (Post-Combat Victory Freeze)
* **Hvað gerist í kóðanum:** Þegar skrímsli fellur (`state.victory` í `action-ui.js`) helst `moveLocked = true`. Spilarinn getur **ekki** ýtt á `W/A/S/D` til að ganga áfram, heldur er hann neyddur til að smella fyrst á `Continue Exploring [Space]` sem sendir auka `GET /api/state` beiðni bara til að opna hreyfingu aftur.
* **Af hverju það líður skrýtið:** Í hasarleik viltu sjá skrímslið falla, sjá gullið/XP fljúga upp á skjáinn, og geta **gengið beint áfram á næsta reit með `W/A/S/D`** án þess að þurfa að loka „tilkynningaglugga“ eftir hvern einasta bardaga.

### 1.6 Einhæfur bardagataktur og tvöfaldir takkar í stjórnborði
* **Hvað gerist í kóðanum:**
  1. Efst eru **2 virkar hendur** (*Right Hand*, *Left Hand*) og hægra megin eru **4 stórir Action-dálkar**, en í bardaga er **Dálkur 3 (*Swap Stance*) óvirkur** (`slot3.disabled = Boolean(enc)`) og vinstri höndin gerir ekkert. Spilarinn ýtir því bara á `Space` (Strike) aftur og aftur.
  2. Árás hetju og árás skrímslis gerast í sama netkalli og birtast með aðeins `210ms` millibili, svo bardaginn rennur saman í eina klessu.
  3. Hægri dálkurinn endurtekur sömu hnappana 2–3 sinnum (`Stance` er á 3 stöðum, `Rest` á 3 stöðum, `Hero` og `Pack` eru tvíteknir í 3×3 grindinni og aftur í röðinni beint fyrir neðan!).

---

## 2. Lausnin: Hvernig við aðlögum leikinn að nýja Action-forminu

Til að leikurinn smelli saman við nýja *First-Person Action Viewport* útlitið þurfum við **ekki** að henda d20 reglunum, földu tölunum eða SQLite grunninum. Við þurfum að breyta **flæðinu og viðbrögðunum (Game Feel & Pacing)** í kringum **4 grunnstoðir**:

### Stoð 1: Eðlileg hreyfing og sjónræn framvinda („Directional Vista & Living Step“)

Markmiðið er að **hvert einasta skref** gefi spilaranum skýra líkamlega tilfinningu fyrir því að hann hafi færst úr stað í heiminum.

1. **Stefnumiðuð myndavélarhreyfing (Directional Camera Physics):**
   Í stað þess að allir takkar spili sama `fpStepBob` hoppið, fær hver átt sína eigin eðlisfræði í glugganum:
   * **`W` (Norður / Áfram):** *Forward Step Dolly* — bakgrunnurinn stækkar mjúklega (`scale(1.0) -> 1.07`) með tveggja þrepa fótataki á meðan þokulagið klofnar til hliðanna.
   * **`S` (Suður / Til baka):** *Backward Retreat Step* — myndavélin dregur sig aftur (`scale(1.06) -> 1.0`) með dimmara jaðarfalli.
   * **`A` (Vestur) & `D` (Austur):** *Lateral Trail Pan* — myndin og forgrunnsþokan renna til hliðar (`translateX`) svo þú skynjar að þú sért að þvera landslagið til vesturs eða austurs.

2. **Sjónræn fjölbreytni innan sama landslags (Tile-Seeded Multi-Layer Parallax):**
   Þótt *Mirkwood Forest* noti grunnmyndina `terrain_forest.webp`, má glugginn **aldrei** líta út fyrir að vera frosinn þegar gengið er á milli tveggja skógarreita:
   * Við reiknum fastan reiknivott út frá hnitum reitsins (`tileSeed = (x * 37 + y * 13)`).
   * Hver reitur fær örlítið mismunandi **sjónarhorn (`object-position` pan & horizontal flip)**, **mismunandi birtu/litblæ** (t.d. dýpri skuggar nær *Heart of the Mirkwood*, gulari móða nær *Rotting Fen*) og **2–3 hreyfanleg forgrunnslög (SVG/CSS Silhouette Layers — trjábolir, rústasteinar, svífandi aska/þoka)** sem færast í parallax við hvert skref.
   * **Niðurstaða:** Þú sérð landslagið raunverulega hreyfast þegar þú gengur!

3. **„Zero-Stop“ hreyfing (Engir óþarfa lásar á `WASD`):**
   * **Eftir sigur (`VICTORY`):** `W/A/S/D` eru **ekki læstir**. Um leið og skrímslið fellur og herfangið birtist getur spilarinn ýtt beint á `W/A/S/D` til að ganga yfir hræið og halda áfram á næsta reit í einni hreyfingu!
   * **Á Stigi 1 (`DISCOVERED` — þegar ekki er Ambush):** Ef spilarinn vill ekki berjast við ógnina sem hann skynjar framundan þarf hann ekki að ýta á sérstakan *Ignore* takka og vera fastur á reitnum — hann getur einfaldlega ýtt á `W/A/S/D` í aðra átt og **laumast sjálfkrafa framhjá ógninni og yfir á næsta reit**!

---

### Stoð 2: Frá „75% tómum reitum“ yfir í lifandi könnun („Active Scouting & World Props“)

Í Action-leik má könnun ekki snúast um að ýta blindandi á `W` og vona að 25% teningur kveiki á bardaga. Spilarinn þarf að hafa **sjónræn markmið** á hverju skrefi:

1. **Stig 1 (`DISCOVERED`) sem skuggamynd í landslaginu (In-Scene Silhouette):**
   * Leyndarreglan í `docs/encounter-design.md` er heilög: Spilarinn má ekki sjá nafn eða mynd skrímslisins á Stigi 1.
   * **En í stað textakassa með rúninni `ᚦ`**, birtist **lifandi, dökk skuggamynd (looming shadow / glowing eyes in the fog)** inni í sjálfu landslaginu!
   * Undir skugganum er stutt vísbendingin (*„Heavy coils slither through the canopy above...“*).
   * **Action-viðbragð:** Ef spilarinn smellir á skuggamyndina (eða ýtir á `Space`), ræðst hetjan fram (*Engage / Charge*) — skrímslið afhjúpast úr þokunni með hvelli og bardaginn hefst samstundis!

2. **Skynjunar-radari á 5×5 Minimap (Spoor & Threat Telegraphing):**
   * Í stað þess að allir aðliggjandi reitir á 5×5 kortinu séu alveg eins, getur hetjan skynjað **slóðir og merki** í 1 reits fjarlægð:
     * `🐾` **Fresh Tracks:** Hærri líkur á bardaga (eða *Bounty Quarry* í nánd).
     * `✨` **Curiosity / Ruin Cache:** Umhverfisviðburður eða kista/altari á reitnum.
     * `💀` **Nemesis Threat:** Varanlegt skrímsli sem geymir herfang fallinnar hetju.
   * *Ranger* sér þessi merki í 2 reita radíus (*Keen Senses*), sem gerir stéttina enn skemmtilegri í könnun.

3. **Stuttir, gagnvirkir umhverfisfundir á „friðsælum“ reitum (Interactive Field Encounters):**
   * Þegar 25% bardagateningurinn kemur **ekki** upp, þarf reiturinn ekki alltaf að vera tómur. Í **15%–20% skrefa** getur birst smellanlegt umhverfisatriði beint í glugganum sem spilarinn getur rannsakað með **einum smelli (`Space`)** án þess að stöðva gönguna ef hann vill sleppa því:
     * **Abandoned Satchel / Bones:** Finndu `2–8 Gold` eða örvar/drykk (með lítilli hættu á gildru/fyrirsát).
     * **Wild Moonpetal Herb:** Gefur strax `+2 til +4 HP` á göngunni án þess að eyða drykk úr bakpoka.
     * **Weathered Waystone / Shrine:** Veitir tímabundna blessun fyrir *næsta bardaga* (t.d. *+1 Attack Roll* eða *Keen Sight*).
     * **Tracks of the Quarry:** Gefur nákvæma stefnu (*North / East / South / West*) að virku *Hunting Contract* skotmarki!

---

### Stoð 3: Meira Action í bardaga — Taktískar hendur og 4 virkar aðgerðir

Viðmótið í `action-ui-lab/` er nú þegar með **Left/Right Hand** hólf og **4 Action-dálka**. Við eigum að láta þessa takka gera bardagann að **alvöru taktísku einvígi** í stað þess að spilarinn ýti bara á `Space`:

| Takki / Hólf | Núverandi virkni í Lab | ⚡ Ný Action-virkni í bardaga |
| :--- | :--- | :--- |
| **`[1 / Space]` Primary Hand** | Venjuleg árás (`ATTACK`) | **Quick / Standard Strike:** Árás með aðalvopni. Hægt að smella beint á skrímslið, á Hægri hönd efst, eða á Dálk 1. |
| **`[2 / Q]` Heavy / Class Action** | Drekka drykk (`POTION`) | **Power Strike / Class Maneuver:** Taktískur valkostur í hverri lotu! <br>• **Fighter:** *Power Cleave* (`-2 Atk / +4 Dmg` eða brýtur *Shield/Guard*).<br>• **Ranger:** *Aimed / Pinning Shot* (bónus gegn *Favored Enemy* eða tefur skrímsli).<br>• **Cleric:** *Sacred Strike / Turn Undead* (auka geislaskaði eða lækkar árás óvinar). |
| **`[3 / E]` Off-Hand / Stance** | **Óvirkur (`disabled`) í bardaga!** | **Guard / Brace & Quick-Swap:** <br>• Ef skjöldur er í vinstri hendi: **Raise Shield (`+3 AC` í þessa lotu & minnkar skaða um helming)**.<br>• Ef bogi er virkur: **Quick-Swap to Melee** án þess að tapa lotu (eða öfugt)! |
| **`[4 / F]` Utility & Escape** | Flótti (`FLEE`) | **Quick Potion (`[Q]`) & Retreat (`[F]`):** Drykkurinn fær sinn eigin flýtihnapp við hlið lífsþolsmælisins og í dálknum svo allir 4 dálkarnir nýtist í hverri einustu lotu. |

#### Tvískiptur bardagataktur (Two-Beat Combat Choreography)
Í stað þess að árás þín og gagnárás skrímslisins birtist á sömu sekúndubrotinu, skiptum við birtingunni í **tvo skýra sjónræna takta** (serverinn reiknar samt allt örugglega í einu `POST /api/action` kalli):
1. **Taktur 1 (`0ms` — Hetjan ræðst til atlögu):** Sverðsveifla / örvaskot teiknast yfir skrímslið -> skrímslið kippist aftur (`monsterHitRecoil`) -> ástandslýsing skrímslisins uppfærist (*„Fresh blood pours from a deep gash...“*).
2. **Taktur 2 (`400ms` — Gagnárás skrímslis):** Skrímslið stekkur fram (`monsterAttackLunge`) -> ef það hittir kemur skjárista (`shake-damage`) og blóðblossi; **ef það geigar (Miss / Blocked)** birtist bláhvítur neisti á skildinum þínum (*„🛡️ Blocked!“* eða *„⚡ Evaded!“*). Í dag gerist *ekkert* sjónrænt þegar skrímsli geigar, sem lætur bardagann virka flatan!

---

### Stoð 4: Hreinsun á hægri dálki (Engir tvíteknir eða dauðir takkar)

Í `action-ui-lab/public/index.html` eru of margir takkar sem gera það sama. Við einföldum hægri dálkinn þannig að hann verði **hraður, skýr og 100% viðbragðsfljótur**:

1. **Fjarlægja tvítekningar:**
   * Í 3×3 hreyfigrindinni (`dm-pad-grid`) eiga hornin að vera **snúnings-/könnunaraðgerðir** (*Look/Scout*, *Camp/Rest*, *Switch Stance*, *Use Herb/Potion*) í stað þess að endurtaka `Hero` og `Pack` sem eru hvort eð er í fliparöðinni beint fyrir neðan.
2. **Engir „dauðir“ takkar í gönguham (`EXPLORATION`):**
   * Í dag er stærsti takkinn í Action-dálkunum (`Slot 1: Strike`) **grár og óvirkur (`disabled`)** þegar þú ert á göngu!
   * Í nýja flæðinu breytist `Slot 1` í gönguham í **`Scout / Search Area [Space]`** (eða *Interact* þegar þú ert á landamerki / rústum / borg), þannig að `Space` takkinn gerir **alltaf** eitthvað gagnlegt og skemmtilegt!

---

## 3. Samanburður: Gamla flæðið vs. Nýja Action-flæðið

| Þáttur | Núverandi `action-ui-lab` | ⚡ Lagfært Action-flæði |
| :--- | :--- | :--- |
| **Ganga á milli reita (`WASD`)** | Sama myndin hoppar upp og niður (`fpStepBob`) í allar 4 áttir. Ekkert breytist innan sama skógar. | Stefnumiðuð hreyfing (Áfram / Aftur / Hliðar-pan) + parallax-forgrunnur og birtubrigði á hverjum reit. |
| **Tómir reitir (75% skrefa)** | Algjörlega tómir; bara textinn *„Path Clear“*. | Sjónræn merki á 5×5 Minimap (`🐾`, `✨`, `💀`) + 15–20% líkur á smellanlegum *World Props* (jurtir, beinagrindur, vegvísar). |
| **Stig 1 (`DISCOVERED`)** | Stór textakassi með `ᚦ` lokar á útsýnið og læsir `WASD`. | Dökk skuggamynd í þokunni inni í landslaginu. `Space` = Áhlaup; `WASD` = Laumast framhjá án þess að stoppa! |
| **Taktur í bardaga (`IN_COMBAT`)** | 1 takki (`Space = Attack`). Stance-skipti bönnuð. Árásir beggja birtast í einni klessu. | 4 virkar aðgerðir (*Strike*, *Power/Class*, *Shield Guard / Quick-Swap*, *Flask/Flee*) + tvískiptur taktur með *Block/Evade* neistum. |
| **Eftir sigur (`VICTORY`)** | `WASD` er læst þar til ýtt er á `Space` (*Continue Exploring*). | Siguryfirlag birtist í senunni en **`WASD` er strax virkt** — næsta skref lokar glugganum sjálfkrafa! |

---

## 4. Tillaga að framkvæmdaáætlun (3 skýrir áfangar í `action-ui-lab/`)

Við getum prófað og fínpússað allar þessar breytingar beint í `action-ui-lab/` sandkassanum áður en við snertum aðalleikinn:

1. **Áfangi A — Hreyfiflæði & „Zero-Stop“ Navigation (Lagar skrýtnu tilfinninguna strax):**
   * Stefnumiðuð myndavélarhreyfing (`North` zoom-in, `South` zoom-out, `East/West` pan + parallax-forgrunnur og tile-seed litbrigði).
   * Aflétta `WASD`-lás eftir sigur (`VICTORY`) svo hægt sé að ganga beint áfram.
   * Breyta Stigi 1 (`DISCOVERED`) úr textakassa í **In-Scene Shadow Silhouette** þar sem `WASD` í aðra átt laumast sjálfkrafa framhjá ógninni (*Auto-Bypass on Move*).
2. **Áfangi B — Tvískiptur bardagataktur, Block/Evade FX & Virkar hendur:**
   * Tvískipta bardagalotunni í *Hero Strike (`0ms`)* -> *Monster Counter (`400ms`)* með sjónrænum *Shield Block / Dodge* áhrifum þegar skrímsli geigar.
   * Opna fyrir *Stance Swap* og *Guard / Power Strike* í bardaga og hreinsa tvítekna takka úr hægri dálki.
3. **Áfangi C — Lifandi Minimap-slóðir & Gagnvirkir umhverfisfundir (World Props):**
   * Bæta við slóðamerkjum á 5×5 Minimap og smellanlegum umhverfisfundum (*Herbs, Waystones, Abandoned Packs*) á göngunni.
