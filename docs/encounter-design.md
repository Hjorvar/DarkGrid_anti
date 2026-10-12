# Darkgrid — Hönnunarforskrift: Leynd og afhjúpun skrímsla (Encounter Secrecy Design)

Þetta skjal lýsir leikjahönnun, viðmótsframsetningu og tæknilegum kvaðum varðandi atburði (encounters), vísbendingar og afhjúpun skrímsla í **Darkgrid**.

---

## 1. Meginregla um leynd (Core Golden Rule)

> **Leikmaður má ekki sjá nafn, mynd eða nákvæmar upplýsingar um skrímsli áður en hann hefur ákveðið að halda áfram með atburðinn.**

Þessi meginregla tryggir að leikmaður upplifi stöðugan ótta og forvitni við könnun heimsins. Í stað þess að lesa tölfræði og sjá mynd strax þarf leikmaður að meta vísbendingar í umhverfinu áður en hann hættir lífi sínu í návígi.

---

## 2. Tvö þrep atburða (Two-Stage Encounter Model)

```
[ Hetja stígur á reit ]
          │
          ▼
   Encounter Check (25% eða virkt skrímsli)
          │
   ┌──────┴──────────────────────────────────────┐
   │                                             │
   ▼ Enginn atburður                             ▼ Atburður virkjast
[ Ferð heldur áfram ]                 [ STIG 1: ÓÞEKKT ÓGN ]
                                      • encounters.status = 'DISCOVERED'
                                      • Nafn & mynd falin
                                      • Vísbendingalýsing (1_distant / 2_ranger)
                                      • Áttaviti læstur
                                                 │
                                ┌────────────────┴────────────────┐
                                │                                 │
                                ▼                                 ▼
                     [ Sniðganga (Ignore) ]            [ Halda áfram (Investigate) ]
                     • encounters.status = 'IGNORED'   • encounters.status = 'IN_COMBAT'
                     • Ferðastýring opnast aftur       │
                     • Skrímsli aldrei afhjúpað        ▼
                                              [ STIG 2: AFHJÚPUN ]
                                              • SAMA skrímsli er notað
                                              • Nafn afhjúpað
                                              • Handmáluð 2D mynd birtist
                                              • Tákn & nákvæm návígislýsing
                                              • Bardagi / Hörfa varlega
```

### Stig 1: Óþekkt ógn (Initial Encounter)
Þegar leikmaður gengur inn á reit þar sem atburður á sér stað:
1. **Server-hlið:** Skrímsli er valið samkvæmt Gaussian líkindadreifingu (reiknað út frá stigi hetju og landsvæði). Færsla er búin til í `encounters` með stöðunni `'DISCOVERED'`.
2. **Textalýsing:** Birt er lýsing úr SQLite gagnagrunni:
   - Venjulegir flokkar fá `1_distant`.
   - Ranger (Veiðimaður) fær glöggari lýsingu `2_ranger_distant`.
3. **Faldir þættir (Leynd):**
   - Ekkert skrímslanafn er birt.
   - Engin mynd er birt.
   - Ekkert tákn (`symbol`) eða sérlitur er sýndur.
   - Engar leikjatölur (HP, CR, AC, skaði) eru sýndar.
   - Enginn leki á sér stað í HTML DOM (ekki í `alt`, `title`, CSS-klösum eða `data-*`).
4. **Viðmótsútlit:**
   - Dularfullur ógnarrammi (`mystery frame`) með rúninni `ᚦ` eða `[?]`.
   - Fyrirsögn: `Ókunn ógn: Óljóst form í skuggunum`.
   - Ranger merki ef við á: `🏹 Veiðimaður greinir vísbendingu`.
5. **Valkostir leikmanns:**
   - **Halda áfram og rannsaka (Investigate):** Sendir POST á `/game/encounter/investigate`.
   - **Sniðganga og forðast (Ignore):** Sendir POST á `/game/encounter/ignore`.

### Stig 2: Afhjúpun (Reveal)
Þegar leikmaður ákveður að rannsaka ógnina:
1. **Server-hlið:** Staða atburðar uppfærist í `'IN_COMBAT'`. Nákvæmlega sama skrímsli (`monster_id`) er notað áfram.
2. **Afhjúpun í viðmóti:**
   - Opinbert nafn skrímslisins birtist (t.d. `Assassin Vine`, `Ghoul`, `Rust Monster`).
   - Handmáluð 2D myndskreyting birtist í 1:1 ramma (`.monster-art-frame`).
   - Tákn skrímslisins birtist með lit (t.d. `[G]`, `[P]`, `[R]`).
   - Nákvæmari návígislýsing birtist (`3_close`, eða `4_ranger_close` fyrir Ranger).
   - Ef Ranger: merkið breytist í `🏹 Veiðimaður í návígi`.
3. **Áframhaldandi leikur:**
   - Leikurinn heldur áfram samkvæmt gildandi bardagakerfi án þess að búa til nýjar bardagareglur.
   - Í Phase 1 er valkostur um að hörfa varlega: **Hörfa varlega (Withdraw)** (POST á `/game/encounter/conclude`).

---

## 3. Úttekt á núverandi lýsingum (Description Audit)

Samkvæmt tæknilegri úttekt á öllum 10 skrímslum í gagnagrunni:

| Skrímsli | 1_distant (Fjarlæg lýsing) | 2_ranger_distant (Veiðimannslýsing) | Staða og athugasemd |
|---|---|---|---|
| **Assassin Vine** | "The undergrowth here is unusually thick, and the vines seem to twitch against the wind." | "You spot the skeletal remains of birds within the brush; this foliage is carnivorous." | ✅ **Fullkomið:** Engin nafngift, dregur upp dökka og hættulega mynd af umhverfinu. |
| **Marsh Leech [DEV]** | "A wet, glistening shape wriggles slowly through the shallow murky puddles." | "Fresh glistening slime trails on the reeds and discarded, drained carcasses signal a parasitic horror waiting in ambush." | ✅ **Fullkomið:** Slóð af slími og tæmd hræ vara við sníkjudýri án þess að nefna blóðsuguna. |
| **Shadow Bramble [DEV]** | "Thorny tangled undergrowth rustles unnaturally in the deep shadows, creeping forward against the breeze." | "Broken twigs and barbs pointing toward the trail indicate animated scrub seeking blood." | ✅ **Fullkomið:** Ónáttúruleg hreyfing í runnum án þess að afhjúpa heiti skrímslisins. |
| **Feral Wolf [DEV]** | "Low amber eyes gleam in the dark shadows between the trees, followed by a muffled snarl." | "Claw prints and tufts of matted grey fur reveal a lone, diseased pack-hunter circling downwind." | ✅ **Fullkomið:** Skýrar vísbendingar um rándýr án þess að afhjúpa úlfinn beint. |
| **Grave Troll [DEV]** | "The earth trembles faintly under heavy, thudding footsteps accompanied by the stench of rotten carrion." | "Crushed boulders and deeply gouged moss reveal a massive brutish humanoid scouring the marsh." | ✅ **Fullkomið:** Þung spor, fnykur og kramdir steinar gefa risavaxna vísbendingu. |
| **Ghoul** | "A sickening stench of rot drifts on the chill wind, accompanied by the wet, sickening crunch of gnawed bone." | "You recognize the frantic, clawed excavations around burial mounds; an undead scavenger is feasting nearby." | ✅ **Fullkomið:** Fnykur af rotnun og uppgrafnar grafir án þess að nefna "Ghoul". |
| **Giant Spider** | "Thick, dust-choked webs drape across the shadows, vibrating faintly as if touched by invisible hands." | "Silk tripwires crisscross the narrow path ahead, rigged to alert an eight-legged ambusher concealed above." | ✅ **Fullkomið:** Vefir og átta-fætt launsátur gefa rétta tilfinningu. |
| **Choker** | "A faint rustle of stones and a dry, rasping scrape echo from the high crevices above the path." | "Gouge marks and pale, rubbery slime on the rocky ceiling reveal the stalking perch of a subterranean strangler." | ✅ **Fullkomið:** Dularfull hljóð í lofti og gúmmíkennt slím. |
| **Rust Monster** | "A strange metallic clinking drifts through the corridor, followed by the acrid, coppery smell of oxidization." | "Discarded flakes of corroded iron and pitted weapon fragments litter the trail—a metal-devourer prowls this sector." | ✅ **Fullkomið:** Málmhljóð, koparlykt og tærðir vopnabútar. |
| **Manticore** | "A piercing, brassy roar reverberates across the ridges, followed by the heavy downdraft of monstrous wings." | "Barbed iron-hard quills embedded deep in shattered stone mark the hunting territory of a territorial aerial chimera." | ✅ **Fullkomið:** Brakandi öskur, vængjaþytur og broddaspjót í bergi. |

> *Athugið: Allar for-ákvörðunarlýsingar (1_distant og 2_ranger_distant) fyrir öll 10 skrímslin í gagnagrunni standast nú 100% kröfur um leynd ógnar.*

---

## 4. Tæknilegar kvaðir og öryggi gegn gagnaleka

Til að tryggja að leyndin sé 100% virk:
1. **Server-Side Rendering (SSR):** EJS sniðmát má aldrei setja `monster_name`, `imageUrl`, eða `symbol` inn í HTML þegar `encounter.status === 'DISCOVERED'`.
2. **Engir faldir lekabendingar:** Engar CSS-klasar (t.d. `monster-ghoul`), engin `data-monster-name` tög og engin `alt="..."` tög mega bera nafn skrímslisins fyrir afhjúpun.
3. **Viðvarandi staða:** Ef notandi endurhleður síðunni (`F5` / reload) á meðan atburður er í `DISCOVERED`, birtist óþekkta ógnin óbreytt. Ef notandi endurhleður síðunni eftir að hafa smellt á Investigate (`IN_COMBAT`), helst afhjúpunin virk.
