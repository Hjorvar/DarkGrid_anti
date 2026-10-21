# DARKGRID ADVENTURE LAB — PHASE 5 ARTWORK VERIFICATION & REVIEW (`PHASE-5-ART-REVIEW.md`)

**Dagsetning:** 2026-10-21  
**Contact Sheet:** [`docs/phase-5/art-candidates/contact_sheet_candidates.png`](art-candidates/contact_sheet_candidates.png)  
**Stöðuregla:** Allar 13 nýju myndirnar eru merktar **`REVIEW REQUIRED`** þar til notandi veitir formlegt samþykki (`APPROVED`).

---

## 1. Tæknileg og sjónræn sannprófun (10-liða gátlisti úr kafla 3.4)

Hver einasta af nýju myndunum 13 í [`docs/phase-5/art-candidates/`](art-candidates/) gekkst undir fulla tæknilega og sjónræna úttekt:

1. **Myndsnið, upplausn og hlutföll:** Allar 13 skrárnar eru gildar JPEG (`0xFFD8` $\rightarrow$ `0xFFD9`) í upplausninni **`1376 × 768`** (`1.792:1` / `~16:9` widescreen).
2. **Opnanleiki og stærð:** Allar skrár eru milli `779 KB` og `1.04 MB`, hlaðast inn án villu í Chromium (`naturalWidth === 1376`, `naturalHeight === 768`) og skila `HTTP 200 (image/jpeg)` á `/lab-assets/art-candidates/<fileName>`.
3. **SHA-256 prófsummur:** Reiknaðar og festar í [`scene-catalog.js`](../../scene-catalog.js) (`CANDIDATE_ART_INVENTORY`) og prófaðar í [`tests/phase-5-world.test.js`](../../tests/phase-5-world.test.js).
4. **Engin afrit (Zero Duplicates):** SHA-256 samanburður allra `73` umhverfismynda í verkefninu (`50` samþykktar í Mode C + `10` aðrar terrain skrár + `13` nýjar) sýnir **`0` afrit**, engar speglanir, engin endurnefnd afrit og engin litabreytt afrit.
5. **Sjónræn skoðun:** Allar 13 myndir skoðaðar beint og á contact sheet (`contact_sheet_candidates.png`). Engin mynd inniheldur texta, vatnsmerki, UI-ramma, nútímahluti eða teiknimyndastíl.
6. **Rétt landslagsgerð:** Hver mynd endurspeglar nákvæmlega sitt vistkerfi eða vistkerfismót (`from_terrain` í forgrunni, `to_terrain` fram undan).
7. **Augnhæð, sjónarhorn og gólfflötur:** Allar 13 myndir eru í 1. persónu augnhæð (`~5.5 ft`) með skýrum, gengum jarðvegi í neðri þriðjungi (`y = 65%–100%`) svo Pathfinder-skrímsli standi eðlilega á jörðinni.
8. **Prófun í raunverulegu viewport:** Allar 13 myndir prófaðar í Candidate Preview Mode (`SET_ART_PREVIEW_MODE` / `?artPreview=candidates`) í Chromium (`screenshots/41_*.png` til `51_*.png`).
9. **Contact Sheet:** Útbúið í [`docs/phase-5/art-candidates/contact_sheet_candidates.png`](art-candidates/contact_sheet_candidates.png) og afritað í [`docs/phase-5/screenshots/00_candidate_art_contact_sheet.png`](screenshots/00_candidate_art_contact_sheet.png).
10. **Governance Staða:** Allar 13 myndirnar eru merktar **`REVIEW REQUIRED`** og breyta ekki sjálfgefnum `APPROVED_DEFAULT` leikmannaham fyrr en notandi samþykkir þær.

---

## 2. Sundurliðuð yfirferð á öllum 13 myndum (`P5-ART-01` – `P5-ART-13`)

| ID | Skrá | Upplausn | Stærð | SHA-256 (fyrstu 16 stafir) | Sjónræn úttekt & Landfræðilegt mat | Staða |
| :--- | :--- | :---: | :---: | :--- | :--- | :---: |
| **`P5-ART-01`** | [`forest_tangled_canopy_pov.jpg`](art-candidates/forest_tangled_canopy_pov.jpg) | `1376×768` | `1,012 KB` | `eb2d3361e8da951b` | Þétt eikar- og askhvelfing yfir rökum skógarstíg; mosavaxnir steinar og rætur við jarðvegsgólf, engin risaeik eða bautasteinn. | `REVIEW REQUIRED` |
| **`P5-ART-02`** | [`forest_misty_birch_hollow_pov.jpg`](art-candidates/forest_misty_birch_hollow_pov.jpg) | `1376×768` | `985 KB` | `8908f382462d7bc8` | Silfurhvítir birkistofnar og dökk grenitré í þokukenndri dæld; burkni og fallin tré meðfram skýrum göngustíg. | `REVIEW REQUIRED` |
| **`P5-ART-03`** | [`plains_rutted_wagon_track_pov.jpg`](art-candidates/plains_rutted_wagon_track_pov.jpg) | `1376×768` | `914 KB` | `49cd02962052f725` | Regnfyllt vagnför í forgrunni sem liggja gegnum vindbarin strá og dökkt lyng undir óveðursskýjum. | `REVIEW REQUIRED` |
| **`P5-ART-04`** | [`plains_lone_barrow_horizon_pov.jpg`](art-candidates/plains_lone_barrow_horizon_pov.jpg) | `1376×768` | `779 KB` | `3c836270a1eb0ca9` | Göngustígur um heiðarlyng sem stefnir í átt að fornri grasvaxinni dys á fjarlægum sjóndeildarhring. | `REVIEW REQUIRED` |
| **`P5-ART-05`** | [`swamp_sunken_roots_channel_pov.jpg`](art-candidates/swamp_sunken_roots_channel_pov.jpg) | `1376×768` | `962 KB` | `457f66a2ff5859d6` | Svart mýrarsíki, krumpaðirมýrarvíðir og flæktar rætur í grængráum þokuanga Rotting Fen (án musterisrústa eða ljóskera). | `REVIEW REQUIRED` |
| **`P5-ART-06`** | [`hills_windswept_scree_pass_pov.jpg`](art-candidates/hills_windswept_scree_pass_pov.jpg) | `1376×768` | `948 KB` | `43b78a3874b43743` | Hrikalegt flögubergsskarð í Raven Crags með skýrum malar- og hellustíg í neðri hluta og þoku í fjallaskörðum. | `REVIEW REQUIRED` |
| **`P5-ART-07`** | [`jungle_briar_thicket_pov.jpg`](art-candidates/jungle_briar_thicket_pov.jpg) | `1376×768` | `1,041 KB` | `f062ab2fcaea5a71` | Þyrnóttar vafningsjurtir, hengimosi, risa-stoðrætur og dauf gulgræn gróþoka yfir blautum steinhellum. | `REVIEW REQUIRED` |
| **`P5-ART-08`** | [`transition_hills_to_swamp_pov.jpg`](art-candidates/transition_hills_to_swamp_pov.jpg) | `1376×768` | `892 KB` | `9572bc5b658839cd` | Brotið grátt flöguberg og lyng í forgrunni (`HILLS`) sem hallar beint niður í svart mýrarvatn og víðitré (`SWAMP`). | `REVIEW REQUIRED` |
| **`P5-ART-09`** | [`transition_swamp_to_plains_pov.jpg`](art-candidates/transition_swamp_to_plains_pov.jpg) | `1376×768` | `884 KB` | `e7e245af6a216d72` | Sokknir brúarplankar og fenjaleðja í forgrunni (`SWAMP`) þar sem stígur klifrar upp á opna grasheiði (`PLAINS`). | `REVIEW REQUIRED` |
| **`P5-ART-10`** | [`transition_hills_to_forest_pov.jpg`](art-candidates/transition_hills_to_forest_pov.jpg) | `1376×768` | `956 KB` | `0dde8059fe925809` | Klettóttur fjallastígur í forgrunni (`HILLS`) sem liggur beint inn undir dimma greniskógarjaðar Mirkwood (`FOREST`). | `REVIEW REQUIRED` |
| **`P5-ART-11`** | [`transition_plains_to_hills_pov.jpg`](art-candidates/transition_plains_to_hills_pov.jpg) | `1376×768` | `928 KB` | `782ae2b0f7ff67e1` | Vindbarið graslendi í forgrunni (`PLAINS`) þar sem slóðin klifrar upp grýttar hlíðar Raven Crags (`HILLS`). | `REVIEW REQUIRED` |
| **`P5-ART-12`** | [`transition_hills_to_plains_pov.jpg`](art-candidates/transition_hills_to_plains_pov.jpg) | `1376×768` | `873 KB` | `6ccfc2b7c0d98536` | Veðraðir klettar í forgrunni (`HILLS`) sem opnast út á víðáttumikla grassteppu (`PLAINS`) til austurs. | `REVIEW REQUIRED` |
| **`P5-ART-13`** | [`watchpost_9_7_south_river_gorge.jpg`](art-candidates/watchpost_9_7_south_river_gorge.jpg) | `1376×768` | `909 KB` | `e13f6b0ec81a3e44` | Horft í suður yfir rofinn steinvegg Bridge East Watchpost (`[9,7]`) með ryðguðu varðspjóti í forgrunni og straumhörðu Blackwater gljúfri fyrir neðan. | `REVIEW REQUIRED` |
