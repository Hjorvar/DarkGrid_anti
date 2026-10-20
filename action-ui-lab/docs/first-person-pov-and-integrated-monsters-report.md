# Darkgrid Action UI Lab — First-Person POV-First Fallback, Ground-Plane Anchoring & Integrated Monsters Report

**Dagsetning:** Október 2026  
**Umfang:** Eingöngu einangrað innan `action-ui-lab/` (engin skrá utan `action-ui-lab/` var snert: engar breytingar á aðalleik, `src/`, `db/`, Firebase eða bardagareglum)  
**Sjálfgefnar stillingar:** `Scene Mode: C (First-Person ★)` og `Monster Mode: 1. Card (Default)` (með `2. Integrated ★` sem tilraunaham til beins samanburðar).

---

## 1. HLUTI A — 5-þrepa POV-First Fallback-kerfi & Crossroads `(7,5)` 4-átta samhengi (`Mode C: First-Person`)

### 1.1 Vandamálið í eldri fallback-rökfræði Mode C
Í fyrri tilraunaútgáfu af `Mode C` féll kerfið til baka á `currentVariant` úr `lab_scene_variants` þegar leikmaður sneri sér í átt sem átti ekki sérmálaða `(x, y, facing)` mynd í `lab_perspective_views`. Auk þess vantaði skýrt forgrunnsgólf (neðstu 40% myndflatarins) og rétta 180° afstöðu rúnasteinsins á `Mirkwood Crossroads (7,5)`:
1. **Á `The Old Stone Bridge (8,7)` þegar horft var `NORTH` eða `SOUTH`:** Kerfið féll áður til baka á `terrain_bridge.webp` — sem er **ytri 3/4 yfirlitsmynd (`OVERVIEW`)** af brúnni utan frá árbakkanum í stað þess að sýna útsýnið af brúargólfinu yfir steinhandriðið út á Blackwater River.
2. **Á `Mirkwood Crossroads (7,5)` (`NORTH`, `SOUTH`, `WEST`, `EAST`):**
   - `NORTH` (`crossroads_7_5_north.jpg`, Tier 1): Horft norður inn í Mirkwood — blágræni rúnasteinninn (`waystone`) stendur **hægra megin** við breiðan forgrunnsstíg sem fyllir neðstu 40% myndarinnar.
   - `SOUTH` (`crossroads_7_5_south.jpg`, Tier 1): 180° viðsnúningur til suðurs — sami rúnasteinn sést nú **vinstra megin** í forgrunni með gjörólíkri trjáumgjörð, breiðum drullu- og hellustíg í neðstu 40%, og Oakhaven North Gate kyndlum í fjarska.
   - `WEST` (`crossroads_7_5_west.jpg`, Tier 2): Horft vestur á ófæran granítklettavegg `Stonefang Crag (6,5)` **án rúnasteins**, með flötu, skýru skógargólfi í neðstu 40% þar sem skrímsli geta staðið.
   - `EAST` (`crossroads_7_5_east.jpg`, Tier 3): Horft austur eftir mosavöxnum skógarstíg Mirkwood **án rúnasteins**, með breiðum jarðvegsstíg í neðstu 40%.

### 1.2 5-þrepa POV-First valröð (`resolveSceneModeC`)
Í [`action-ui-lab/scene-catalog.js`](../scene-catalog.js) tryggir `resolveSceneModeC` með 5-þrepa (`POV_TIERS`) forgangsröð að **aldrei** sé fallið til baka á `OVERVIEW` yfirlitsmyndir eða `LANDMARK_LOCKED` myndir sem snúa í ranga átt:

| Þrep | Heiti (`povTier`) | Lýsing og hlutverk | Dæmi í `action-ui-lab/` |
|---|---|---|---|
| **Tier 1** | `EXACT_POV` (`Tier 1: Exact POV`) | Nákvæm handmáluð augnhæðarmynd (~1,65 m) fyrir `(x, y, facing)` þar sem hetjan stendur á reitnum og horfir í valda átt. | `(8,7)` `EAST` (`bridge_8_7_east.jpg`), `(8,7)` `WEST` (`bridge_8_7_west.jpg`), `(7,5)` `NORTH` (`crossroads_7_5_north.jpg`), `(7,5)` `SOUTH` (`crossroads_7_5_south.jpg`), `(7,6)` `NORTH`/`SOUTH`. |
| **Tier 2** | `LANDMARK_DIRECTIONAL_POV` (`Tier 2: Landmark POV`) | Stefnuvirk augnhæðarmynd af kennileiti eða ófærum tálma út frá núverandi reit (t.d. horft yfir brúarhandrið út á ána eða horft á klettavegg úr skóginum). | `(8,7)` `NORTH` (`bridge_8_7_north.jpg` — Blackwater River yfir norðurhandrið brúar), `(8,7)` `SOUTH` (`bridge_8_7_south.jpg` — Blackwater River yfir suðurhandrið brúar), `(7,5)` `WEST` (`crossroads_7_5_west.jpg` — Stonefang Crag klettaveggur séður innan úr Mirkwood án rúnasteins). |
| **Tier 3** | `SUBBIOME_CONTEXT_POV` (`Tier 3: Sub-biome POV`) | Augnhæðarmynd sem passar við undir-vistkerfi og samhengi reitsins án þess að endurtaka stefnubundið kennileiti í rangri átt. | `(7,5)` `EAST` (`crossroads_7_5_east.jpg` — austurslóð Mirkwood í augnhæð án rúnasteins); eða þegar horft er að ófærum klettum/ám af almennum skógarreitum. |
| **Tier 4** | `GENERIC_TERRAIN_POV` (`Tier 4: Terrain POV`) | Almenn augnhæðarmynd fyrir landslagstegund reitsins (`camera_type = 'POV'`, `safe_for_pov_fallback = 1`, `has_directional_landmark = 0`). | Almennir `FOREST`, `PLAINS`, `SWAMP`, `MOUNTAIN`, `RUINS` reitir sem nota hreinar augnhæðarmyndir án miðjusettar einsteinungs- eða yfirlitsmyndar. |
| **Tier 5** | `SAFE_NEUTRAL_POV` (`Tier 5: Safe POV`) | Örugg hlutlaus augnhæðarmynd fyrir reiti þar sem sjálfgefin mynd reitsins er `OVERVIEW` (eins og `terrain_city_oakhaven.webp` eða `terrain_bridge.webp`). | Ef staðið er í `Oakhaven (7,7)` og horft í átt sem á ekki enn sérmálaða götumynd, notar Tier 5 augnhæðarmynd frá hliðinu/götunni (`north_gate_7_6_south.jpg` / `north_gate_7_6_north.jpg`) í stað þess að hoppa upp í fuglasýn yfir þökin. |

---

## 2. HLUTI B — Jarðtenging (`Stage Anchor`), líffræðilegir snertiskuggar og svífandi Manticore (`Integrated Mode`)

### 2.1 Lausn á „svífandi skrímslum“ og „svarta kassaskugganum“
Í fyrri tilraun sátu skrímsli í `.fp-center-stage` í miðjum glugganum (`justify-content: center`) án `margin-top: auto` og notuðu einn breiðan, flatan svartan skuggalista (`div.fp-monster-ground-shadow`) ásamt þungum niður-skugga (`drop-shadow(0 16px 20px ...)`) á allri myndinni. Þetta olli því að:
- Skrímsli virtust svífa í lausu lofti í miðjum skjánum (`y ~ 50%`).
- Breiður svartur bjálki lá undir kviðnum á `Wolf`, undir lafandi klónum á `Ghoul`, og beint undir afturlöppunum á `Manticore`.

Í núverandi útfærslu var þetta leyst með þríþættu kerfi:

1. **Forgrunnsgólf (`computeSceneStageAnchor` í [`scene-catalog.js`](../scene-catalog.js)):**
   - Hver sena reiknar `stageAnchor` (`stageFloorY: 82–83%`, `stageCenterX`, `stageScale`, `groundSurfaceType`, `groundShadowTint`, `isWalkableCombatStage`).
   - `.fp-monster-actor.is-integrated-monster` notar `margin-top: auto; margin-bottom: 2px;` þannig að jarðbundnar verur standa beint á forgrunnsveginum/stígnum í neðri hluta myndarinnar.
   - Árþoka og neðri vignette voru létt í [`action-ui.css`](../public/action-ui.css) og `focal_y` hækkað í `60–64%` þannig að neðstu 40% vegarins haldast skýr og sýnileg.

2. **Líffræðilegir snertiskuggar (`contactPatches` + `ambientPatch` í [`server.js`](../server.js) og [`action-ui.js`](../public/action-ui.js)):**
   - Gamli svarti skuggabjálkinn (`div.fp-monster-ground-shadow`) er falinn í `Integrated` ham og í staðinn teiknar `.fp-integrated-grounding-rig` nákvæma snertiskugga (`contactPatches`) á mældum `(leftPct%, topPct%)` hnitum þar sem loppur, fætur eða rætur snerta jörðina:
     - **`Wolf` (`ground_quadruped`)**: 3 aðskildir loppuskuggar (`Hind Right Paw` á `(9.5%, 86.4%)`, `Front Right & Hind Left Paws` á `(47.5%, 83.2%)`, `Front Left Paw` á `(70.5%, 97.4%)`) + mjór, hallandi ambient-skuggi (`rotate(-5deg)`). Enginn svartur bjálki undir kviðnum.
     - **`Ghoul` (`ground_crouched_humanoid`)**: 2 fótarskuggar (`Right Foot` á `(34.5%, 89.8%)` og `Left Planted Foot` á `(72.5%, 97.2%)`). Lafandi klær vinstra og hægra megin eru í lausu lofti og kasta **engum** snertiskugga.
     - **`Assassin Vine` (`ground_coiled_plant`)**: 3 rótarskuggar (`Left Root Tendril Cluster` á `(24%, 93.2%)`, `Central Trunk Base Coil` á `(48%, 97.0%)`, `Right Root Coil` á `(76%, 93.0%)`) sem festa flækjuna beint í jarðveginn.

3. **Sannur svífandi `Manticore` (`airborne_hover`):**
   - Nýtt RGBA cutout ([`manticore.png`](../public/images/monsters-cutout/manticore.png), `1022×845`) sýnir Manticore **á flugi í lausu lofti** með útbreidda leðurblökuvængi, allar 4 loppur uppi frá jörðu og sporðinn sveigðan í lofti.
   - `Manticore` er hækkaður upp í glugganum (`verticalOffsetPx: -48`, `margin-bottom: 34px`, `airborneGapPx: 52`) með **>= 45px lóðréttu loftbili** á milli neðstu loppa og dreifða flugskuggans (`ambientPatch` á `topPct: 115`, `blur: 14px`, `opacity: 0.44`) á veginum fyrir neðan, og enga `contactPatches` (`contactPatches: []`).

---

## 3. Sjónræn staðfesting og skjáskot (`1600×900`)

Öll 21 uppfærð og sannreynd skjáskot eru vistuð í [`action-ui-lab/docs/screenshots/pov-and-monsters/`](screenshots/pov-and-monsters/):

### HLUTI A — POV-First sjónarhorn (`Mode C`)
- **The Old Stone Bridge `(8,7)` (`E / N / W / S`):**
  - `01-bridge-8-7-east-pov.png` — Horft `EAST` eftir brúargólfinu að Watchpost (`Tier 1: Exact POV`).
  - `02-bridge-8-7-north-river-pov.png` — Horft `NORTH` yfir steinhandrið brúarinnar út á Blackwater River (`Tier 2: Landmark POV`).
  - `03-bridge-8-7-west-pov.png` — Horft `WEST` eftir brúargólfinu til baka að Oakhaven (`Tier 1: Exact POV`).
  - `04-bridge-8-7-south-river-pov.png` — Horft `SOUTH` yfir steinhandrið brúarinnar niður Blackwater River (`Tier 2: Landmark POV`).
- **Mirkwood Crossroads `(7,5)` (`N / W / S / E`):**
  - `05-crossroads-7-5-north-waystone-pov.png` — Horft `NORTH` inn í Mirkwood með rúnasteininn hægra megin og breiðan stíg í forgrunni (`Tier 1: Exact POV`).
  - `06-crossroads-7-5-west-crag-pov.png` — Horft `WEST` á ófæran klettavegg Stonefang Crag án rúnasteins með flötu skógargólfi í forgrunni (`Tier 2: Landmark POV`).
  - `07-crossroads-7-5-south-pov.png` — Horft `SOUTH` (180° snúningur) með rúnasteininn vinstra megin, ólík tré og Oakhaven North Gate í fjarska (`Tier 1: Exact POV`).
  - `08-crossroads-7-5-east-track-pov.png` — Horft `EAST` eftir mosavöxnum skógarstíg án rúnasteins (`Tier 3: Sub-biome POV`).

### HLUTI B — `Card` vs. `Integrated` skrímsli (`Mode C`)
- **Á The Old Stone Bridge `(8,7)`:**
  - `09-bridge-manticore-card.png` vs. `10-bridge-manticore-integrated-airborne.png` (Manticore á flugi með skýru loftbili yfir dreifðum vegskugga).
  - `11-bridge-ghoul-card.png` vs. `12-bridge-ghoul-integrated-grounded.png` (Ghoul stendur á brúarhellunum með 2 fótarskuggum, engum skugga undir lafandi klóm).
  - `13-bridge-wolf-integrated-grounded.png` (Wolf stendur á brúarveginum með 3 loppuskuggum).
  - `14-bridge-vine-integrated-grounded.png` (Assassin Vine á brúarveginum með 3 rótarskuggum).
- **Á Mirkwood Crossroads `(7,5)` í öllum 4 áttum (`N / S / E / W`):**
  - `15-crossroads-north-vine-card.png` vs. `16-crossroads-north-vine-integrated.png` (`NORTH` — Assassin Vine á skógarstígnum við rúnasteininn).
  - `17-crossroads-north-wolf-card.png` vs. `18-crossroads-north-wolf-integrated.png` (`NORTH` — Wolf á skógarstígnum með 3 loppuskuggum).
  - `19-crossroads-south-ghoul-integrated.png` (`SOUTH` — Ghoul á suðurstígnum með rúnasteininn vinstra megin).
  - `20-crossroads-east-manticore-integrated-airborne.png` (`EAST` — Manticore svífur yfir austurstígnum).
  - `20b-crossroads-west-wolf-integrated.png` (`WEST` — Wolf á skógargólfinu fyrir framan Stonefang Crag klettavegginn).
  - `21-safe-card-fallback-rust-monster.png` (Öruggt `Card` fallback fyrir `Rust Monster`).
