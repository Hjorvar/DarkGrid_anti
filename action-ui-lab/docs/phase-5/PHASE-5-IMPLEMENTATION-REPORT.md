# DARKGRID ADVENTURE LAB — PHASE 5 IMPLEMENTATION REPORT (`PHASE-5-IMPLEMENTATION-REPORT.md`)

**Dagsetning:** 2026-10-21  
**Vinnugrein:** `phase_5_world_completion`  
**Umfang breytinga:** Eingöngu innan `action-ui-lab/` (0 skrár utan `action-ui-lab/` snertar).

---

## 1. Yfirlit yfir breyttar og nýjar skrár í `action-ui-lab/`

| Skrá | Tegund | Hlutverk breytingar |
| :--- | :---: | :--- |
| [`action-ui-lab/scene-catalog.js`](../../scene-catalog.js) | Uppfærð | 12 nýjar Tier 1 aðkomureglur (`DEFAULT_PERSPECTIVE_VIEWS`), lagfæring á `SWAMP` og `JUNGLE` vistkerfishreinleika, Tier 1/2/3 árekstrarvörn í Tier 4, `CANDIDATE_ART_INVENTORY`, `CANDIDATE_TIER4_POOLS`, og `useCandidateArt` staging stuðningur |
| [`action-ui-lab/travel-continuity.js`](../../travel-continuity.js) | Uppfærð | Fullgerðar `CORRIDOR_STEP_NARRATIVES` fyrir `SOUTHERN_ROTTING_FEN_CORRIDOR` (`[7,9] <-> [6,9] <-> [6,10] <-> [5,10] <-> [4,10] <-> [4,11]`) og `WESTERN_RAVEN_CRAGS_CORRIDOR` (`[5,5] <-> [4,5] <-> [3,5]`) |
| [`action-ui-lab/server.js`](../../server.js) | Uppfærð | Útflutningur á `CANDIDATE_ART_INVENTORY`, `CANDIDATE_TIER4_POOLS`, `setCandidateArtPreviewMode` og `getCandidateArtPreviewMode` |
| [`action-ui-lab/server/middleware/static-assets.js`](../../server/middleware/static-assets.js) | Uppfærð | Static route `/lab-assets/art-candidates/*` með `no-store` hausum fyrir myndirnar í `docs/phase-5/art-candidates/` |
| [`action-ui-lab/server/controllers/state-controller.js`](../../server/controllers/state-controller.js) | Uppfærð | Stuðningur við `?artPreview=candidates` á `/api/atlas` og `/api/state` ásamt `candidateArtInventory` í `/api/visual-qa` |
| [`action-ui-lab/server/controllers/action-controller.js`](../../server/controllers/action-controller.js) | Uppfærð | Ný aðgerð `SET_ART_PREVIEW_MODE` á `POST /api/action` til að kveikja og slökkva á Candidate Art Preview Mode í lifandi prófunum |
| [`action-ui-lab/tests/phase-5-world.test.js`](../../tests/phase-5-world.test.js) | Ný | Sjálfvirk prófunarsvíta (7 ítarleg próf) fyrir Phase 5 |
| [`action-ui-lab/docs/phase-5/art-candidates/`](art-candidates/) | Nýjar (14) | 13 nýjar 1376×768 JPEG umhverfismyndir (`REVIEW REQUIRED`) + `contact_sheet_candidates.png` |
| [`action-ui-lab/docs/phase-5/screenshots/`](screenshots/) | Nýjar (56) | 56 lifandi Chromium skjámyndir úr 4 upplausnum og öllum helstu kennileitum og candidate-senum |

---

## 2. Helstu tæknilegar úrbætur

### 2.1 4-átta aðkomur að kennileitum (`DEFAULT_PERSPECTIVE_VIEWS`)
Bætt var við 12 nýjum Tier 1 (`EXACT_POV`) reglum í `DEFAULT_PERSPECTIVE_VIEWS` sem tryggja að þegar leikmaður nálgast kennileiti úr hvaða gengri höfuðátt sem er, þá sjái hann kennileitið fram undan:
- **Oakhaven (`[7,7]`) og hliðin (`[7,6]`, `[7,8]`) úr vestri:** `[6,7] EAST`, `[6,6] EAST`, `[6,8] EAST`.
- **Primeval Black Oak (`[7,3]`) úr austri og vestri:** `[6,3] EAST`, `[8,3] WEST`.
- **Mirkwood Crossroads (`[7,5]`) úr austri:** `[8,5] WEST`.
- **Rotting Fen Boardwalk (`[6,10]`) úr norðri:** `[6,9] SOUTH`.
- **Deadman’s Mire (`[4,11]`) úr austri og suðri:** `[5,11] WEST`, `[4,12] NORTH`.
- **Bioluminescent Spore Hollow (`[9,11]`) úr vestri, austri og suðri:** `[8,11] EAST`, `[10,11] WEST`, `[9,12] NORTH`.

### 2.2 Vistkerfishreinleiki í `SWAMP` og `JUNGLE`
- Í `DEFAULT_SCENE_VARIANTS` var `swamp_overgrown_bog` (`SWAMP` variant 1) breytt úr `/images/terrain/terrain_jungle.webp` í `/lab-assets/images/perspective/transition_plains_to_swamp_pov.jpg`.
- `jungle_shadowed_hollow` (`JUNGLE` variant 1) var breytt úr `/images/terrain/terrain_forest.webp` í `/lab-assets/images/perspective/transition_swamp_to_jungle_pov.jpg`.
- Þetta útrýmdi öllum `57` tilvikum af `WRONG TERRAIN` í heiminum.

### 2.3 Árekstrarvörn milli Tier 1/2/3 og Tier 4 á sama reit
- Í `resolveSceneModeCCore` og `resolveSceneModeC` var bætt við athugun á öllum virkum `lab_perspective_views` (Tier 1) og `lab_pov_context_rules` (Tier 2/3) á sama reit (`facing != currentFacing`) svo Tier 4 velji aldrei sömu mynd á hliðarátt og sértæk kennileitis- eða mótamynd notar á annarri átt sama reits.

### 2.4 Staging / Preview arkitektúr fyrir `REVIEW REQUIRED` myndir
- Til að virða ströngu regluna í kafla 3.4 (*„Engin ný mynd fær stöðuna APPROVED án míns samþykkis ... ekki skipta út samþykktum player-facing myndum varanlega fyrr en samþykki liggur fyrir“*) var byggt inn staging-kerfi:
  - Í **sjálfgefnum leikmannaham (`APPROVED_DEFAULT`)** notar leikurinn eingöngu samþykktar myndir (`artApprovalStatus: 'APPROVED'`), en hver sena ber jafnframt `candidatePreview` lýsigögn ef ný mynd bíður samþykkis fyrir það sjónarhorn.
  - Í **Candidate Preview Mode (`CANDIDATES_STAGED`)**, sem virkja má með `/api/atlas?artPreview=candidates`, `/api/state?artPreview=candidates` eða `POST /api/action { action: 'SET_ART_PREVIEW_MODE', enabled: true }`, virkjast allar 13 nýju myndirnar úr `docs/phase-5/art-candidates/` og skila `640/640 PASS` (`0` `DUPLICATE`, `0` `MISSING ART`) og `63` einstökum myndum.
