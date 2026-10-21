# DARKGRID ADVENTURE LAB — PHASE 5 WORLD & SCENE AUDIT (`PHASE-5-WORLD-AUDIT.md`)

**Dagsetning:** 2026-10-21  
**Vinnugrein:** `phase_5_world_completion`  
**Vélrænt gagnasett:** [`docs/phase-5/scene-coverage.json`](scene-coverage.json)

---

## 1. Yfirlit yfir heimskort og sjónarhorn (15×15 World Grid)

Darkgrid Adventure Lab heimurinn samanstendur af **15×15** hnitaneti (`x = 0..14`, `y = 0..14`):

| Mælikvarði | Gildi | Skýring |
| :--- | :---: | :--- |
| **Heildarfjöldi reita (`totalTiles`)** | `225` | `15 × 15` hnitanet |
| **Gengir reitir (`passableTiles`)** | `160` | Reitir sem leikmaður getur ferðast um |
| **Ófærir reitir (`impassableTiles`)** | `65` | Fjöll (`MOUNTAINS`), Blackwater River (`RIVER_LAKE`), Murksea (`OCEAN`) og Bottomless Mire (`SWAMP`) |
| **Geng sjónarhorn (`passableViewpoints`)** | `640` | `160` gengir reitir × `4` höfuðáttir (`NORTH`, `EAST`, `SOUTH`, `WEST`) |
| **Heildarsjónarhorn (`totalViewpoints`)** | `900` | `225 × 4` |

### Dreifing gengra reita eftir vistkerfum (Biomes)
- **Mirkwood Forest (`FOREST`):** `41` reitir (`164` sjónarhorn)
- **Verdant Plains & Windblown Heath (`PLAINS`):** `46` reitir (`184` sjónarhorn)
- **Rotting Fen (`SWAMP`):** `33` reitir (`132` sjónarhorn)
- **Raven Crags (`HILLS`):** `25` reitir (`100` sjónarhorn)
- **Venomous Jungle (`JUNGLE`):** `12` reitir (`48` sjónarhorn)
- **Oakhaven Sanctuary (`CITY`):** `1` reitur (`4` sjónarhorn — `[7,7]`)
- **The Old Stone Bridge (`BRIDGE`):** `1` reitur (`4` sjónarhorn — `[8,7]`)
- **Bridge East Watchpost (`UNDERGROUND_RUINS`):** `1` reitur (`4` sjónarhorn — `[9,7]`)

---

## 2. Flokkun allra 640 gengra sjónarhorna (Audit Classification)

Öll `640` sjónarhorn voru greind vélrænt og sjónrænt samkvæmt 8 flokkum verkefnalýsingarinnar og vistuð í [`docs/phase-5/scene-coverage.json`](scene-coverage.json):

| Flokkur | Fyrir Phase 5 (Baseline) | Phase 5 Sjálfgefið (`APPROVED_DEFAULT`) | Phase 5 Með 13 Nýjum Myndum (`CANDIDATES_STAGED`) | Skýring á breytingu |
| :--- | :---: | :---: | :---: | :--- |
| **`PASS`** | `359` | `412` | **`640`** | Fullkomið landfræðilegt, áttbundið og vistkerfislegt samræmi |
| **`DUPLICATE`** | `159` | `175` | **`0`** | Tvær áttir á sama reit deila sömu Tier 4 mynd vegna 3-mynda safns (leyst í `0` þegar 4. mynd bætist við hvert vistkerfi) |
| **`WRONG TERRAIN`** | `57` | **`0`** | **`0`** | `SWAMP` notaði áður hitabeltisfrumskóg (`terrain_jungle.webp`) og `JUNGLE` notaði laufskóg (`terrain_forest.webp`) |
| **`WRONG DIRECTION`** | `0` | **`0`** | **`0`** | Engin áttavilla í áttavita eða snúningi |
| **`MISSING ART`** | `1` | `53`* | **`0`** | *Í `APPROVED_DEFAULT` bíða `53` sjónarhorn (`1` Tier 1 á `[9,7] SOUTH` + `52` Tier 3 biome transitions) samþykkis á nýju myndunum í `art-candidates/` |
| **`MISLEADING OBSTACLE`** | `0` | **`0`** | **`0`** | Allar ófærar hindranir (`65` reitir + heimsendar) sýna skýra hindrun (`isBlockedAhead: true`) |
| **`TRANSITION MISMATCH`** | `18` | **`0`** | **`0`** | Allar 12 biome-mótareglur (`lab_pov_context_rules`) virkjaðar og samræmdar |
| **`LANDMARK MISMATCH`** | `46` | **`0`** | **`0`** | 12 nýjar Tier 1 aðkomumyndir (`EXACT_POV`) bættar við og Tier 4 látið forðast Tier 1/2/3 myndir á sama reit |
| **Samtals** | **`640`** | **`640`** | **`640`** | `100%` þekja yfir alla `160` genga reiti |

---

## 3. Greining á helstu frávikum sem fundust í Baseline og voru lagfærð í Phase 5

### 3.1 `WRONG TERRAIN` (57 sjónarhorn $\rightarrow$ 0)
1. **Rotting Fen (`SWAMP`) sýndi hitabeltisfrumskóg (`terrain_jungle.webp`):**
   - Í `DEFAULT_SCENE_VARIANTS` vísaði `swamp_overgrown_bog` (`variant_index: 1`) á `/images/terrain/terrain_jungle.webp`. Þetta olli því að `47` sjónarhorn í Rotting Fen sýndu suðrænan frumskóg þótt leikmaður væri í mýri.
   - **Lausn:** Í `APPROVED_DEFAULT` vísar `swamp_overgrown_bog` nú á samþykktu mýrarmyndina `/lab-assets/images/perspective/transition_plains_to_swamp_pov.jpg`, og í `CANDIDATES_STAGED` bætist 4. mýrarmyndin `swamp_sunken_roots_channel_pov.jpg` (`REVIEW REQUIRED`) við Tier 4 safnið.
2. **Venomous Jungle (`JUNGLE`) sýndi tempraðan eikarskóg (`terrain_forest.webp`):**
   - Í `DEFAULT_SCENE_VARIANTS` vísaði `jungle_shadowed_hollow` (`variant_index: 1`) á `/images/terrain/terrain_forest.webp`, sem olli `10` sjónarhornum með röngu vistkerfi.
   - **Lausn:** Í `APPROVED_DEFAULT` vísar `jungle_shadowed_hollow` nú á samþykktu frumskógarmyndina `/lab-assets/images/perspective/transition_swamp_to_jungle_pov.jpg`, og í `CANDIDATES_STAGED` bætist `jungle_briar_thicket_pov.jpg` (`REVIEW REQUIRED`) við Tier 4 safnið.

### 3.2 `LANDMARK MISMATCH` (46 sjónarhorn $\rightarrow$ 0)
1. **`forest_tangled_canopy` í almenna `FOREST` Tier 4 safninu (`34` sjónarhorn):**
   - Í eldri útgáfu notaði `forest_tangled_canopy` myndina `ancient_oak_7_3_south.jpg` (sem sýnir risa-rótargeig Primeval Black Oak á `[7,3]`), þannig að risaeikin birtist á 34 ótengdum skógarreitum.
   - **Lausn:** Nýja myndin `forest_tangled_canopy_pov.jpg` (`REVIEW REQUIRED`) leysir þetta með hreinum Mirkwood skógarstíg án kennileitis.
2. **Vantaði Tier 1 (`EXACT_POV`) aðkomusýn að kennileitum úr öllum áttum (`12` sjónarhorn):**
   - **Oakhaven (`[7,7]`) og hliðin (`[7,6]`, `[7,8]`) úr vestri:** Reitir `[6,7] EAST`, `[6,6] EAST` og `[6,8] EAST` sýndu áður almenna sléttu í stað timburvirkis og vesturhliðs Oakhaven. Nú leyst með Tier 1 reglum (`fp_plains_6_7_east_oakhaven`, `fp_plains_6_6_east_north_gate`, `fp_plains_6_8_east_south_gate`).
   - **Primeval Black Oak (`[7,3]`) úr austri og vestri:** Reitir `[6,3] EAST` og `[8,3] WEST` sýndu áður almennan skóg í stað aðkomu að risaeikinni (`forest_7_4_north_oak_approach.jpg`). Nú eru allar 4 aðkomuáttir (`[7,4] N`, `[7,2] S`, `[6,3] E`, `[8,3] W`) með Tier 1 aðkomumynd.
   - **Mirkwood Crossroads (`[7,5]`) úr austri:** Reitur `[8,5] WEST` hefur nú Tier 1 aðkomumynd (`crossroads_7_5_lateral.jpg`).
   - **Deadman's Mire (`[4,11]`) úr austri og suðri:** Reitir `[5,11] WEST` og `[4,12] NORTH` bættust við `[4,10] SOUTH` og `[3,11] EAST`, þannig að allar 4 aðkomuáttir að hrundu musterisrústunum sýna `swamp_approach_mire_ruins.jpg`.
   - **Rotting Fen Boardwalk (`[6,10]`) úr norðri:** Reitur `[6,9] SOUTH` fékk Tier 1 aðkomumynd (`swamp_willow_boardwalk_pov.jpg`).
   - **Bioluminescent Spore Hollow (`[9,11]`) úr vestri, austri og suðri:** Reitir `[8,11] EAST`, `[10,11] WEST` og `[9,12] NORTH` fengu Tier 1 aðkomumynd (`jungle_venomous_trail_pov.jpg`).
3. **Sama-reits árekstur milli Tier 1/2/3 og Tier 4:**
   - Á reitum eins og `[3,5]` (Raven Crags), `[12,4]` (Windblown Heath), `[6,10]` (Rotting Fen Boardwalk) og `[9,11]` (Venomous Jungle) gat Tier 4 valið sömu mynd á hliðarátt og Tier 1 kennileitið notaði á aðalátt.
   - **Lausn:** `resolveSceneModeCCore` og `resolveSceneModeC` bæta nú öllum virkum `lab_perspective_views` (Tier 1) og `lab_pov_context_rules` (Tier 2/3) myndum sama reits í `adjacentContextImages` / `sameTileFp` svo Tier 4 velji alltaf aðra mynd úr safninu.

### 3.3 `TRANSITION MISMATCH` & `MISSING ART` (52 Tier 3 sjónarhorn + 1 Tier 1 sjónarhorn)
- Fimm vistkerfismót (`HILLS -> SWAMP`, `SWAMP -> PLAINS`, `HILLS -> FOREST`, `PLAINS -> HILLS`, `HILLS -> PLAINS`) og suðurhlíð Bridge East Watchpost (`[9,7] SOUTH`) notuðu áður samþykktar staðgengilsmyndir.
- Allar 6 myndirnar hafa nú verið útbúnar í fullri upplausn (`1376×768`) í `docs/phase-5/art-candidates/` og tengdar við Candidate Preview Mode (`?artPreview=candidates`).

---

## 4. Forgangsröðun Scene Resolver (5-Tier Priority Hierarchy)

Scene resolverinn í [`scene-catalog.js`](../../scene-catalog.js) fylgir strangri 5-þrepa forgangsröðun þar sem lægra þrep getur aldrei yfirskrifað hærra þrep:

1. **Tier 1 — Specific Landmark & Approach (`EXACT_POV`, `55` sjónarhorn):** Hnit- og áttbundnar myndir í `lab_perspective_views` fyrir öll 13 kennileiti og aðkomur þeirra.
2. **Tier 2 — Landmark Feature Context (`LANDMARK_CONTEXT_POV`, `2` sjónarhorn):** Reglur sem miða við `from_feature` / `to_feature`.
3. **Tier 3 — Specific Obstacle / Barrier & Biome Transition (`SUBBIOME_CONTEXT_POV`, `133` sjónarhorn):** Reglur fyrir ófærar hindranir (`to_passable = 0`: fjöll, Blackwater River, Murksea, Bottomless Mire) og vistkerfismót (`from_terrain -> to_terrain`).
4. **Tier 4 — Deterministic Biome POV Pool (`GENERIC_TERRAIN_POV`, `450` sjónarhorn):** Hnit- og áttbundið (`computeDeterministicVariantIndex(x, y, pool.length, facing)`) val úr `POV`-merktu safni vistkerfisins, með árekstrarvörn gegn Tier 1/2/3 myndum á sama reit.
5. **Tier 5 — Safe Neutral Fallback (`SAFE_NEUTRAL_POV`, `0` sjónarhorn í notkun):** Öruggt varanet sem aldrei er þörf á í núverandi 15×15 heimi.
