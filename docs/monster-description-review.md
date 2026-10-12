# Darkgrid — Gæðapróf á skrímslalýsingum (Monster Description Quality Audit)

Þessi skýrsla tekur saman heildarúttekt á öllum textalýsingum skrímsla í SQLite-gagnagrunni **Darkgrid** (`data/darkgrid.sqlite`).

Úttektin byggir á gildandi leikhönnun og reglum um leynd ógnar samkvæmt [`docs/encounter-design.md`](file:///c:/Users/hih/Documents/antiDark/docs/encounter-design.md), [`.agents/rules/encounter-design.md`](file:///c:/Users/hih/Documents/antiDark/.agents/rules/encounter-design.md) og [`.agents/specs/DARKGRID_GAME_SPEC.md`](file:///c:/Users/hih/Documents/antiDark/.agents/specs/DARKGRID_GAME_SPEC.md).

> [!NOTE]
> **Staða aðgerða:** Lagfæringartillögur á lýsingunum sem féllu hafa verið **samþykktar og innleiddar** í SQLite gagnagrunninn (`data/darkgrid.sqlite`) og í fræskrána [`db/seeds/002_seed_monsters.sql`](file:///c:/Users/hih/Documents/antiDark/db/seeds/002_seed_monsters.sql). Allar 20 for-ákvörðunarlýsingar standast nú 100% kröfur leiksins (A og B).

---

## 1. Tæknileg greining: Hvernig velur og birtir leikurinn lýsingar?

Samkvæmt skoðun á kóðagrunninum (sérstaklega [`src/domain/encounters/engine.js`](file:///c:/Users/hih/Documents/antiDark/src/domain/encounters/engine.js) og fallinu `resolveMonsterDescription`) er atburðakerfið strangt tveggja þrepa módel:

```
[ Hetja stígur á reit ]
          │
          ▼
   Encounter Check (25% líkur eða virkt skrímsli)
          │
          ▼
   [ STIG 1: ÓÞEKKT ÓGN — status: 'DISCOVERED' ]
   • Birtir eingöngu: `1_distant` (fyrir Fighter/Cleric) eða `2_ranger_distant` (fyrir Ranger).
   • Nafn, mynd, tákn, litur og bardagatölur eru 100% FALIN.
   • Leikmaður velur: [ Investigate (Rannsaka) ] eða [ Ignore (Sniðganga) ].
          │
          ├─────────────────────────────────────────┐
          ▼                                         ▼
   [ Ignore (Sniðganga) ]            [ Investigate (Rannsaka) ]
   • status: 'IGNORED'               • status: 'IN_COMBAT'
   • Ferðastýring opnast             • STIG 2: AFHJÚPUN
   • Skrímsli aldrei afhjúpað        • Nafn, 2D mynd og tákn birtast
                                     • Birtir `3_close` eða `4_ranger_close`
                                     • Áverkalýsingar (5-9) virkjast í bardaga
```

### Lykilniðurstaða um birtingu:
1. **Fyrir ákvörðun leikmanns (Stig 1):** Leikurinn birtir **eingöngu** lýsingar `1_distant` og `2_ranger_distant`. Þessar 20 lýsingar (2 fyrir hvert af 10 skrímslum) eru þær einu sem leikmaður sér áður en hann ákveður hvort hann hættir lífi sínu. Það eru þessar lýsingar sem **verða** að uppfylla kröfur um leynd, dularfullar vísbendingar og óvissu.
2. **Eftir ákvörðun leikmanns (Stig 2):** Þegar leikmaður smellir á *Investigate*, er skrímslið formlega afhjúpað í viðmótinu. Þá birtast `3_close` (eða `4_ranger_close`), sem eiga að lýsa skepnunni í návígi og veita taktískar upplýsingar.
3. **Áverkalýsingar í bardaga (Phase 2):** Lýsingar `5_health_100` til `9_dead` eru hannaðar til að birtast í bardagalotanum þegar HP skrímslis lækkar. Þær eiga að sýna líkamlegt ástand án þess að leka tölulegu HP.

---

## 2. Matskerfi og viðmið

Hverri lýsingu var gefin einkunn á kvarðanum **A – D**:

- **A – Góð og dularfull:** Skapar spennu og andrúmsloft. Gefur óbeinar vísbendingar (hljóð, lykt, umhverfi, hreyfing). Afhjúpar ekki tegund skrímslis. Leikmaður þarf að túlka vísbendingarnar.
- **B – Sterk vísbending:** Gefur gagnlegar upplýsingar um stærð, hegðun eða eðli hættunnar. Leikmaður getur dregið rökréttar ályktanir, en fleiri en ein vera gæti passað við lýsinguna. Ásættanleg og góð vísbending (sérstaklega mikilvæg fyrir Ranger).
- **C – Of augljós:** Inniheldur svo einkennandi útlitsatriði eða orðalag að auðvelt er að þekkja skrímslið eða nafn þess fyrir ákvörðun leikmannsins. Mælt er með endurskrifun.
- **D – Afhjúpar skrímslið:** Nefnir skrímslið eða tegund þess beint með nafni. Nánast engin óvissa er eftir. Inniheldur upplýsingar sem leikmaður á ekki að vita ennþá. Þarf tafarlausa endurskrifun.

---

## 3. Heildartölfræði úttektarinnar

### Fyrir lagfæringu:
- **Heildarfjöldi skrímsla:** 10
- **Heildarfjöldi lýsinga:** 90 (9 á hvert skrímsli)
- **Stig 1 lýsingar (1_distant & 2_ranger_distant):** 20
  - Flokkur A: 8 (40.0%)
  - Flokkur B: 10 (50.0%)
  - Flokkur C: 1 (5.0%) — *Shadow Bramble (1_distant)*
  - Flokkur D: 1 (5.0%) — *Marsh Leech (2_ranger_distant)*
  - **Hlutfall sem stóðst prófið (A og B):** 18 / 20 (**90.0%**)

### Eftir innleiðingu lagfæringa:
- **Flokkur A (Góð og dularfull):** 9 (45.0%)
- **Flokkur B (Sterk vísbending):** 11 (55.0%)
- **Flokkur C (Of augljós):** 0 (0.0%)
- **Flokkur D (Afhjúpar skrímslið):** 0 (0.0%)
- **Nýtt hlutfall sem stenst prófið (A og B):** **20 / 20 (100.0%)** ✅

---

## 4. Lýsingar sem fengu fall (C eða D) og tillögur að úrbótum

Í öllum gagnagrunninum eru nákvæmlega **tvær** lýsingar sem brjóta gegn leyndarreglum Stigs 1:

---

### 1. Shadow Bramble — `1_distant`
- **Skrímsli:** Shadow Bramble [DEV-PLACEHOLDER] (ID 3, CR 0.5, Level 1)
- **Lykill:** `1_distant` (Fjarlæg lýsing fyrir venjulegar hetjur)
- **Einkunn:** **C (Of augljós)**
- **Núverandi texti:**
  > *"Thorny brambles rustle in the shadow of the trees, creeping unnaturally forward."*
- **Ástæða fyrir einkunn:**
  Lýsingin notar bæði lykilorðin úr nafni skrímslisins: **„brambles“** og **„shadow“** í sömu setningunni. Þetta gerir leikmanni of auðvelt að bera kennsl á skrímslið strax við komu á reitinn, áður en hann tekur ákvörðun um að rannsaka ógnina.
- **Tillaga að nýrri lýsingu:**
  > *"Thorny tangled undergrowth rustles unnaturally in the deep shadows, creeping forward against the breeze."*
- **Rökstuðningur fyrir nýrri lýsingu:**
  Orðinu „brambles“ er skipt út fyrir „tangled undergrowth“ og orðalaginu breytt þannig að óhugnanleg hreyfing gróðursins nýtur sín án þess að gefa upp opinbert nafn skrímslisins. Leikmaður veit að hættulegur og óeðlilegur gróður er á ferð, en veit ekki með vissu hvaða óvættur býr að baki.

---

### 2. Marsh Leech — `2_ranger_distant`
- **Skrímsli:** Marsh Leech [DEV-PLACEHOLDER] (ID 2, CR 0.5, Level 1)
- **Lykill:** `2_ranger_distant` (Sérstök vísbending fyrir Veiðimann)
- **Einkunn:** **D (Afhjúpar skrímslið)**
- **Núverandi texti:**
  > *"Fresh slime trails on the reeds signal a hungry blood-leech waiting in ambush."*
- **Ástæða fyrir einkunn:**
  Lýsingin nefnir orðið **„blood-leech“** beint. Í leik þar sem skrímslið heitir „Marsh Leech“ er engin óvissa eftir. Þótt Veiðimaður eigi að fá betri og gagnlegri vísbendingu en aðrir, kveða reglurnar skýrt á um að hann megi aldrei sjá heiti skrímslisins áður en ákvörðun er tekin.
- **Tillaga að nýrri lýsingu:**
  > *"Fresh glistening slime trails on the reeds and discarded, drained carcasses signal a parasitic horror waiting in ambush."*
- **Rökstuðningur fyrir nýrri lýsingu:**
  Nafninu „blood-leech“ er skipt út fyrir „parasitic horror“ og bætt er við sjónrænum ummerkjum um blóðtæmd dýrahræ. Þetta veitir Veiðimanninum framúrskarandi taktíska vísbendingu um líffræðilega hættu (sníkjudýr/blóðsuga) án þess að eyðileggja spennuna eða nafngreina skrímslið.

---

## 5. Heildaryfirlit: Einkunnir allra níu lýsinga fyrir öll 10 skrímsli

Eftirfarandi fylki sýnir heildarmat á öllum 90 lýsingum í gagnagrunninum.

- **Dálkar 1 & 2 (`1_dist` & `2_rng_d`):** Metið stranglega samkvæmt for-ákvörðunarrýni (Stage 1 Secrecy).
- **Dálkar 3 & 4 (`3_close` & `4_rng_c`):** Metið sem návígislýsingar við afhjúpun (Stage 2 Combat Reveal). Athugað hvort textinn sé lýsandi, gefi taktíska dýpt og forðist talnaleka (HP/CR).
- **Dálkar 5 til 9 (`H100` – `Dead`):** Metið sem bardaga-áverkalýsingar (Health Progression). Athugað hvort líffræðileg lýsing passi við skrímslið og hvort forðast sé að nefna töluleg stig.

| ID | Skrímsli | CR | 1_dist | 2_rng_d | 3_close | 4_rng_c | 5_H100 | 6_H75 | 7_H50 | 8_H25 | 9_Dead | Samantekt og staða |
|---|---|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|---|
| **1** | **Assassin Vine** | 3.0 | **A** | **B** | A | A | A | A | A | A | A | ✅ Fullkomið. Plöntulíffræði í áverkum (lekur hvítum safa). |
| **2** | **Marsh Leech** | 0.5 | **A** | **B** | A | A | A | A | A | A | A | ✅ Lagfært (áður D). Nú lýst sem „parasitic horror“ með tæmdum hræjum. |
| **3** | **Shadow Bramble** | 0.5 | **A** | **B** | A | A | A | A | A | A | A | ✅ Lagfært (áður C). Nú lýst sem „tangled undergrowth in deep shadows“. |
| **4** | **Feral Wolf** | 1.0 | **A** | **B** | A | A | A | A | A | A | A | ✅ Frábær spenna í fjarlægð (amber augu), raunhæf áverkaferli. |
| **5** | **Grave Troll** | 4.0 | **A** | **B** | A | A | A | A | A | A | A | ✅ Þung spor og fnykur; holdið reynir að gróa í bardaga. |
| **126** | **Ghoul** | 1.0 | **A** | **B** | A | A | A | A | A | A | A | ✅ Óhugnanlegur fnykur og beinanödr; holdið molnar í bardaga. |
| **127** | **Giant Spider** | 1.0 | **B** | **B** | A | A | A | A | A | A | A | ✅ Vefir titra; hemolymph lekur; fætur krullast í dauða. |
| **128** | **Choker** | 2.0 | **A** | **B** | A | A | A | A | A | A | A | ✅ Skrap í lofti; gúmmíkennt slím; beinlausir armar. |
| **129** | **Rust Monster** | 3.0 | **A** | **B** | A | A | A | A | A | A | A | ✅ Koparkennd oxunarlykt; tærð málmbrot; fálmarar leita stáls. |
| **130** | **Manticore** | 5.0 | **A** | **B** | A | A | A | A | A | A | A | ✅ Brakandi öskur og vængjaþytur; fjaðrir/broddar í bergi. |

---

## 6. Sérstök athugun á gæðakröfum leikhönnunar

Í samræmi við kafla 3 í fyrirmælum voru eftirfarandi atriði sérstaklega könnuð:

### 1. Eru tölur nefndar í textalýsingum? (HP, AC, CR, Damage)
- **Niðurstaða: 100% Hreint.** Engin af 90 lýsingunum inniheldur tölulegar upplýsingar um HP, Challenge Rating, Armor Class eða teningaköst. Allur skaði og heilsubreytingar eru tjáðar með lýsandi texta í stað talna.

### 2. Eru áverkalýsingar líffræðilega viðeigandi?
- **Niðurstaða: Framúrskarandi samræmi.**
  - **Plöntur (`Assassin Vine`, `Shadow Bramble`):** Blæða ekki rauðu blóði heldur leka „thick, white sap“ eða „bitter greenish resin“, og stofnar klofna („main trunk is split“).
  - **Ódrep / Undead (`Ghoul`):** Sýna ekki eðlilega sársaukatjáningu heldur „black ichor“, „desiccated limbs fracture“, og „unnatural hunger finally quenched“.
  - **Liðdýr / Skordýr (`Giant Spider`, `Rust Monster`):** Skel brotnar („pierced chitin plates“), „cloudy hemolymph oozes“, og fætur krullast saman við dauða.
  - **Frávik / Aberrations (`Choker`, `Marsh Leech`):** Gúmmíkennt hold, „yellow grease“, innyfli leka í forina, og beinlausir limir slappast.
  - **Skepnur / Rándýr (`Feral Wolf`, `Manticore`, `Grave Troll`):** Vöðvar rifna, vængjahimnur tætast, hold trollins reynir að gróa saman („muscle fibers visibly strain to knit shut“).

### 3. Veita Veiðimannslýsingar (`2_ranger_distant`) taktískt virði?
- Allar Veiðimannslýsingar veita mikilvægar vísbendingar sem hjálpa leikmanni að meta áhættu:
  - *Assassin Vine:* Greinir að gróðurinn er holdæta vegna fuglabeina í runnanum.
  - *Marsh Leech:* Greinir slóð af slími og tæmd hræ (sníkjudýrahætta).
  - *Shadow Bramble:* Greinir brotin tré og brodda sem leita á veginn (blóðþyrstur runni).
  - *Ghoul:* Greinir uppgrafnar grafir sem tilheyra ódauðum hræætum.
  - *Rust Monster:* Greinir tærð málmbrot og varar við málmætandi ógn.
  - *Manticore:* Greinir járnharða brodda í klettum, sem varar við hættu á skotárásum úr lofti.

---

## 7. Samantekt og staða

1. **Allar lýsingar standast prófið:** Eftir innleiðingu lagfæringa standast **100% (20 af 20)** for-ákvörðunarlýsinga gæðaprófið með einkunn A eða B.
2. **Gagnagrunnur og fræskrár eru samstillt:** SQLite gagnagrunnurinn (`data/darkgrid.sqlite`) og [`db/seeds/002_seed_monsters.sql`](file:///c:/Users/hih/Documents/antiDark/db/seeds/002_seed_monsters.sql) innihalda báðar uppfærðu textana.
3. **Sjálfvirk próf:** Öll 27 próf leiksins keyra og standast án athugasemda.
