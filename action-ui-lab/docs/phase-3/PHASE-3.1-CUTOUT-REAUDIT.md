# DARKGRID — Phase 3.1: Visual Re-Audit of All 37 RGBA Cutouts

**Date:** 2026-10-21  
**Branch:** `monster_scale_combat_presentation`  
**Scope:** Strict visual inspection and re-extraction audit of all **37 RGBA cutouts** (`7 EXISTING_APPROVED` + `30 NEWLY_PRODUCED_VERIFIED`) in `action-ui-lab/public/images/monsters-cutout/`

---

## 1. Executive Summary & Classification Totals

Following the Phase 3 review finding on `monster_06_medium_flying_harpy_bridge.png`, we conducted a **full human-grade visual re-audit** of every single cutout in `action-ui-lab/public/images/monsters-cutout/*.png`. Rather than relying on automated pixel thresholds alone, every cutout was composited and inspected side-by-side across **four visual contexts**:
1. **Original `1024×1024` Source Painting** (`public/images/monsters/<slug>.png`)
2. **Cutout on Dark Combat Slate (`#12161E`)**
3. **Cutout on Neutral Parchment (`#D2CDC3`)**
4. **Cutout on High-Contrast Diagnostic Magenta (`#FF00FF`)**
5. **Live In-Scene Chromium Combat Stage Rendering** (`1920×1080`, `1366×768`, `1280×800`)

### Final Classification Summary (37 Total Cutouts)

| Classification | Count | Description |
|:---------------|------:|:------------|
| `APPROVED_CLEAN` | **7** | Original 7 baseline cutouts (`assassin_vine`, `ghoul`, `giant_spider`, `manticore`, `skeletal_champion`, `troll`, `wolf`). Visually clean across all backgrounds; preserved untouched. |
| `FIXED_AND_REVERIFIED` | **30** | All 30 Priority Tier 1 cutouts re-extracted using `IS-Net` (`isnet-general-use`) neural segmentation + surgical anatomical refinement, eliminating all polygonal trimap slabs, background rocks/pillars, and internal alpha holes. |
| `DOWNGRADED_TO_CARD_FALLBACK` | **0** | Zero cutouts required downgrading after neural re-extraction and surgical cleanup. |
| **Total Verified Cutouts** | **37** | **100% visually verified on Dark, Light, Magenta, and Live Combat Stage** |

---

## 2. Root Cause Analysis of Phase 3 Cutout Defects

### Why Automated Pixel Checks Passed While Visual Defects Remained
In Phase 3, `action-ui-lab/scripts/produce-monster-cutouts.js` used a rule-based polygon-trimap + chromatic threshold pipeline (`WARM_CREATURE`, `DARK_SPECTER`, `BRIGHT_ICE`). While all 30 generated files satisfied the 6 numeric checks in `validateCutoutRgbaBuffer` (`transparentPixelRatio` between `15%–88%`, `opaqueCoreRatio >= 10%`, `borderTransparencyRatio === 100%`), visual inspection on our 4-panel contact sheets (`action-ui-lab/docs/phase-3/screenshots/phase-3.1/cutout_audit_before_sheet_1..4.png`) exposed two systemic failure modes of rule-based chromatic matting on hand-painted dark fantasy art:

1. **Polygonal Trimap Background Slabs (`WARM_CREATURE` / `DARK_SPECTER` Bleed):**
   - Because Darkgrid's hand-painted backgrounds feature warm brown tree trunks, amber-lit stone arches, earthy mud, and dark vignette corners that share RGB values with creature fur, feathers, and leather, the chromatic threshold retained the entire polygon trimap interior whenever background elements shared the creature's palette.
   - **Harpy (`harpy.png`):** Retained large triangular brown background slabs under both wings and around the tail (`cutout_audit_before_sheet_3.png`, row 3).
   - **Dire Rat (`dire_rat.png`):** Retained 5 vertical rectangular bars around its legs and tail (`cutout_audit_before_sheet_3.png`, row 1).
   - **Wraith (`wraith.png`):** Retained a massive black trapezoidal block of tomb background around its spectral robe (`cutout_audit_before_sheet_4.png`, row 2).
   - **Ogre (`ogre.png`),Gnoll (`gnoll.png`), Bugbear (`bugbear.png`):** Retained polygonal chunks of brown stone arches and cave walls around their clubs and shoulders.
2. **Internal Alpha Holes on Cool-Toned / White Creature Surfaces:**
   - Conversely, when a creature had cool grey/white highlights or shadowed recessed armor that resembled the cool blue-grey background mist, the chromatic filter punched transparent holes inside the creature's torso.
   - **Winter Wolf (`winter_wolf.png`):** Had a large transparent hole right through the center of its white chest and ribs (`cutout_audit_before_sheet_2.png`, row 8).
   - **Kobold (`kobold.png`), Giant Crab (`giant_crab.png`), Rust Monster (`rust_monster.png`):** Had semi-transparent swiss-cheese holes inside their chest or carapace.

---

## 3. Phase 3.1 Re-Extraction Pipeline (`IS-Net` + Surgical Matting)

To fix all 30 `NEWLY_PRODUCED_VERIFIED` cutouts to true production quality:
1. **High-Precision Neural Foreground Segmentation (`isnet-general-use`):** Every source painting (`public/images/monsters/<slug>.png`) was processed through `IS-Net` (`isnet-general-use` via `rembg`), which is trained specifically for fine boundary segmentation (individual feathers, fur tufts, claws, insect legs, and weapon shafts) without relying on coarse polygon boxes.
2. **Creature-Specific Surgical Refinements:**
   - **`harpy`:** Trimmed the lower-left diagonal stone perch line below the talons (`y > 0.72 * H - (x / W) * 0.14 * H`), leaving only the airborne Harpy, her feathers, and her talons.
   - **`wyvern`:** Trimmed the small cliff rock point beneath the lower talon (`y > 892`), yielding a 100% airborne winged drake/wyvern silhouette.
   - **`ankheg`:** Combined `IS-Net` upper body segmentation (preserving the fine antennae, mandibles, and green acid drips) with `U2-Net` lower leg segmentation (`y >= 560`) to cleanly exclude the foreground dirt clods beneath its legs.
   - **`minotaur`:** Applied an exact coordinate polygon mask over the double-bitted iron greataxe head and lower pommel in his left hand so 100% of his weapon is solid (`alpha = 255`) alongside the `IS-Net` body mask.
   - **`ochre_jelly`:** Suppressed cold grey dungeon floor stones (`sat < 0.23, lum < 145`) between the lower yellow ooze tendrils.
   - **`will_o_wisp`:** Applied radial luminance + cyan-energy alpha matting with edge despill so the glowing skull and ectoplasmic wisps float naturally on both dark and light backgrounds with zero dark rectangular swamp background.
3. **Connected-Component Island Removal & Tight 12px Margin Crop:** Filtered out any detached mist/debris islands and cropped tightly to the `alpha > 20` bounding box with a uniform `12px` transparent perimeter (`borderTransparencyRatio === 100.0%`).

---

## 4. Visual Audit Contact Sheets (Before vs. After)

All 37 cutouts are documented across 4 Before sheets and 4 After sheets in `action-ui-lab/docs/phase-3/screenshots/phase-3.1/`:
- **Sheet 1 (`#01–#10`):** [Before (`cutout_audit_before_sheet_1.png`)](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/monster_scale_combat_presentation/action-ui-lab/docs/phase-3/screenshots/phase-3.1/cutout_audit_before_sheet_1.png) | [After (`cutout_audit_after_sheet_1.png`)](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/monster_scale_combat_presentation/action-ui-lab/docs/phase-3/screenshots/phase-3.1/cutout_audit_after_sheet_1.png)
- **Sheet 2 (`#11–#20`):** [Before (`cutout_audit_before_sheet_2.png`)](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/monster_scale_combat_presentation/action-ui-lab/docs/phase-3/screenshots/phase-3.1/cutout_audit_before_sheet_2.png) | [After (`cutout_audit_after_sheet_2.png`)](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/monster_scale_combat_presentation/action-ui-lab/docs/phase-3/screenshots/phase-3.1/cutout_audit_after_sheet_2.png)
- **Sheet 3 (`#21–#30`):** [Before (`cutout_audit_before_sheet_3.png`)](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/monster_scale_combat_presentation/action-ui-lab/docs/phase-3/screenshots/phase-3.1/cutout_audit_before_sheet_3.png) | [After (`cutout_audit_after_sheet_3.png`)](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/monster_scale_combat_presentation/action-ui-lab/docs/phase-3/screenshots/phase-3.1/cutout_audit_after_sheet_3.png)
- **Sheet 4 (`#31–#37`):** [Before (`cutout_audit_before_sheet_4.png`)](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/monster_scale_combat_presentation/action-ui-lab/docs/phase-3/screenshots/phase-3.1/cutout_audit_before_sheet_4.png) | [After (`cutout_audit_after_sheet_4.png`)](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/monster_scale_combat_presentation/action-ui-lab/docs/phase-3/screenshots/phase-3.1/cutout_audit_after_sheet_4.png)

---

## 5. Complete 37-Cutout Visual Audit Table

| # | Slug | Name | PF1e Size | Phase 3 Origin | Phase 3.1 Classification | Pre-Fix Visual Inspection Finding | Post-Fix Visual Verification & Metrics |
|--:|:-----|:-----|:----------|:---------------|:-------------------------|:----------------------------------|:---------------------------------------|
| 1 | `assassin_vine` | Assassin Vine | `LARGE` | `EXISTING_APPROVED` | `APPROVED_CLEAN` | Clean vine tendrils and root mass on all 3 test backgrounds. | Preserved untouched (`796×885`, trans `52.8%`, core `42.7%`, border `100%`). |
| 2 | `ghoul` | Ghoul | `MEDIUM` | `EXISTING_APPROVED` | `APPROVED_CLEAN` | Crisp crouched undead silhouette, claws, and tongue. | Preserved untouched (`783×706`, trans `59.9%`, core `37.7%`, border `100%`). |
| 3 | `giant_spider` | Giant Spider | `MEDIUM` | `EXISTING_APPROVED` | `APPROVED_CLEAN` | Clean 8-leg arachnid silhouette and mandibles. | Preserved untouched (`860×570`, trans `68.4%`, core `30.4%`, border `100%`). |
| 4 | `manticore` | Manticore | `LARGE` | `EXISTING_APPROVED` | `APPROVED_CLEAN` | Clean bat wings, lion body, and spiked tail. | Preserved untouched (`1022×845`, trans `66.9%`, core `32.5%`, border `100%`). |
| 5 | `skeletal_champion` | Skeletal Champion | `MEDIUM` | `EXISTING_APPROVED` | `APPROVED_CLEAN` | Crisp armor, broadsword, shield, and tattered cape. | Preserved untouched (`579×860`, trans `52.1%`, core `46.9%`, border `100%`). |
| 6 | `troll` | Troll | `LARGE` | `EXISTING_APPROVED` | `APPROVED_CLEAN` | Clean towering regenerating brute silhouette and claws. | Preserved untouched (`643×860`, trans `42.6%`, core `56.5%`, border `100%`). |
| 7 | `wolf` | Wolf | `MEDIUM` | `EXISTING_APPROVED` | `APPROVED_CLEAN` | Clean snarling lupine fur contour and legs. | Preserved untouched (`827×777`, trans `53.0%`, core `45.2%`, border `100%`). |
| 8 | `ankheg` | Ankheg | `LARGE` | `NEWLY_PRODUCED_VERIFIED` | `FIXED_AND_REVERIFIED` | Polygonal dirt slabs around legs and mandibles. | Hybrid `IS-Net` + `U2-Net` lower boundary removes dirt clods while keeping acid drips & antennae (`684×830`, trans `62.4%`, core `36.0%`, border `100%`). |
| 9 | `basilisk` | Basilisk | `MEDIUM` | `NEWLY_PRODUCED_VERIFIED` | `FIXED_AND_REVERIFIED` | Angular polygon stone remnants around dorsal spines and legs. | Crisp 8-legged reptile silhouette & dorsal spines (`749×576`, trans `52.0%`, core `47.0%`, border `100%`). |
| 10 | `blood_hawk` | Blood Hawk | `TINY` | `NEWLY_PRODUCED_VERIFIED` | `FIXED_AND_REVERIFIED` | Polygonal brown webbing between primary wingtips and tail feathers. | Individual crimson wing and tail feathers cleanly separated (`877×834`, trans `59.3%`, core `39.8%`, border `100%`). |
| 11 | `bugbear` | Bugbear | `MEDIUM` | `NEWLY_PRODUCED_VERIFIED` | `FIXED_AND_REVERIFIED` | Retained brown cave wall polygon behind morningstar and left shoulder. | Clean furred brute, shield, and spiked morningstar (`737×947`, trans `47.3%`, core `51.9%`, border `100%`). |
| 12 | `dire_rat` | Dire Rat | `SMALL` | `NEWLY_PRODUCED_VERIFIED` | `FIXED_AND_REVERIFIED` | Severe defect: 5 vertical rectangular brown bars around legs and tail. | Clean crouched rodent contour, paws, and tail (`856×722`, trans `58.0%`, core `41.2%`, border `100%`). |
| 13 | `gargoyle` | Gargoyle | `MEDIUM` | `NEWLY_PRODUCED_VERIFIED` | `FIXED_AND_REVERIFIED` | Semi-transparent holes inside stone chest/wings and angular wing webbing. | Solid stone skin core (`53.3%` opaque core) with crisp bat-wing membrane contour (`764×835`, trans `45.8%`, border `100%`). |
| 14 | `giant_crab` | Giant Crab | `MEDIUM` | `NEWLY_PRODUCED_VERIFIED` | `FIXED_AND_REVERIFIED` | Internal alpha holes across upper carapace and polygonal sand blocks between legs. | Solid chitinous shell and clean separation between all walking legs and pincers (`880×837`, trans `56.4%`, core `42.4%`, border `100%`). |
| 15 | `giant_scorpion` | Giant Scorpion | `LARGE` | `NEWLY_PRODUCED_VERIFIED` | `FIXED_AND_REVERIFIED` | Polygonal brown desert background retained under tail arch and between claws. | Clean segmented stinger arch, pedipalps, and legs (`881×837`, trans `70.7%`, core `28.3%`, border `100%`). |
| 16 | `gnoll` | Gnoll | `MEDIUM` | `NEWLY_PRODUCED_VERIFIED` | `FIXED_AND_REVERIFIED` | Retained warm stone pillar slabs behind spear/axe and hyena mane. | Crisp hyena-warrior silhouette, spear, and shield (`721×916`, trans `46.5%`, core `52.7%`, border `100%`). |
| 17 | `goblin` | Goblin | `SMALL` | `NEWLY_PRODUCED_VERIFIED` | `FIXED_AND_REVERIFIED` | Retained brown background triangles under ears and between legs. | Clean ears, ragged armor, and short blade (`697×855`, trans `59.2%`, core `39.9%`, border `100%`). |
| 18 | `griffon` | Griffon | `LARGE` | `NEWLY_PRODUCED_VERIFIED` | `FIXED_AND_REVERIFIED` | Polygonal brown blocks around eagle wings and hind legs. | Clean feathered wings, eagle beak, and lion hindquarters (`825×824`, trans `50.3%`, core `48.9%`, border `100%`). |
| 19 | `harpy` | Harpy | `MEDIUM` | `NEWLY_PRODUCED_VERIFIED` | `FIXED_AND_REVERIFIED` | **Primary Reported Issue:** Large polygonal brown background triangles under both wings and around tail. | **100% Fixed:** Individual wing feathers, tail feathers, and talons cleanly extracted; lower-left perch rock removed (`842×930`, trans `57.4%`, core `41.6%`, border `100%`). |
| 20 | `human_skeleton` | Human Skeleton | `MEDIUM` | `NEWLY_PRODUCED_VERIFIED` | `FIXED_AND_REVERIFIED` | Retained tomb wall patches around ribcage and scimitar. | Clean ribcage negative space, bones, shield, and rusted scimitar (`761×918`, trans `76.8%`, core `22.0%`, border `100%`). |
| 21 | `human_zombie` | Human Zombie | `MEDIUM` | `NEWLY_PRODUCED_VERIFIED` | `FIXED_AND_REVERIFIED` | Internal alpha holes in torso and polygonal background strips along arms. | Solid rotting corpse silhouette and tattered rags (`618×905`, trans `67.2%`, core `31.8%`, border `100%`). |
| 22 | `kobold` | Kobold | `SMALL` | `NEWLY_PRODUCED_VERIFIED` | `FIXED_AND_REVERIFIED` | Internal alpha holes in chest/snout and polygonal brown blocks around tail/spear. | Solid reptilian body, spear, and tail (`622×653`, trans `59.6%`, core `39.4%`, border `100%`). |
| 23 | `lizardfolk` | Lizardfolk | `MEDIUM` | `NEWLY_PRODUCED_VERIFIED` | `FIXED_AND_REVERIFIED` | Retained swamp tree/branch polygons behind club and shield. | Crisp crested reptile warrior, wooden shield, and morningstar (`803×880`, trans `54.0%`, core `45.1%`, border `100%`). |
| 24 | `minotaur` | Minotaur | `LARGE` | `NEWLY_PRODUCED_VERIFIED` | `FIXED_AND_REVERIFIED` | Polygonal dungeon wall slabs around horns, shoulders, and hooves. | Clean bull horns, muscular frame, hooves, and full double-bitted greataxe (`823×943`, trans `49.7%`, core `49.3%`, border `100%`). |
| 25 | `mummy` | Mummy | `MEDIUM` | `NEWLY_PRODUCED_VERIFIED` | `FIXED_AND_REVERIFIED` | Polygonal sarcophagus background behind trailing linen wraps. | Clean wrapped undead figure and trailing bandages (`709×928`, trans `67.9%`, core `31.1%`, border `100%`). |
| 26 | `ochre_jelly` | Ochre Jelly | `LARGE` | `NEWLY_PRODUCED_VERIFIED` | `FIXED_AND_REVERIFIED` | Retained dungeon floor slabs around amoeboid base. | Clean golden-ochre ooze mass and pseudopods with grey floor stones suppressed (`928×714`, trans `53.7%`, core `45.3%`, border `100%`). |
| 27 | `ogre` | Ogre | `LARGE` | `NEWLY_PRODUCED_VERIFIED` | `FIXED_AND_REVERIFIED` | Large brown arch polygons retained around greatclub and shoulders. | Clean towering giant brute silhouette and spiked greatclub (`854×983`, trans `53.3%`, core `45.9%`, border `100%`). |
| 28 | `orc` | Orc | `MEDIUM` | `NEWLY_PRODUCED_VERIFIED` | `FIXED_AND_REVERIFIED` | Polygonal brown blocks behind greataxe and shoulders. | Clean armored orc berserker and notched greataxe (`684×904`, trans `42.3%`, core `57.0%`, border `100%`). |
| 29 | `owlbear` | Owlbear | `LARGE` | `NEWLY_PRODUCED_VERIFIED` | `FIXED_AND_REVERIFIED` | Polygonal brown forest slabs around claws and feathered shoulders. | Clean feathered owl-bear hybrid silhouette, beak, and raised claws (`773×867`, trans `41.7%`, core `57.6%`, border `100%`). |
| 30 | `rust_monster` | Rust Monster | `MEDIUM` | `NEWLY_PRODUCED_VERIFIED` | `FIXED_AND_REVERIFIED` | Internal alpha holes in carapace and polygonal blocks around feathery antennae. | Solid armored insectoid body, tail propeller, and feathery antennae (`818×848`, trans `61.7%`, core `37.4%`, border `100%`). |
| 31 | `shadow` | Shadow | `MEDIUM` | `NEWLY_PRODUCED_VERIFIED` | `FIXED_AND_REVERIFIED` | Angular black polygon cutout around undead shade. | Clean billowy dark wraith/shadow silhouette (`531×838`, trans `60.7%`, core `38.0%`, border `100%`). |
| 32 | `stirge` | Stirge | `TINY` | `NEWLY_PRODUCED_VERIFIED` | `FIXED_AND_REVERIFIED` | Large brown polygon triangles between wings, proboscis, and hooked legs. | Clean insectoid wings, long proboscis, and grasping legs (`753×746`, trans `71.0%`, core `28.1%`, border `100%`). |
| 33 | `viper` | Viper | `TINY` | `NEWLY_PRODUCED_VERIFIED` | `FIXED_AND_REVERIFIED` | Retained brown ground polygons around coiled body and fangs. | Clean coiled serpent silhouette and open fangs (`850×851`, trans `45.5%`, core `53.9%`, border `100%`). |
| 34 | `will_o_wisp` | Will-o'-Wisp | `SMALL` | `NEWLY_PRODUCED_VERIFIED` | `FIXED_AND_REVERIFIED` | Faint dark swamp octagon retained around outer cyan glow. | Radial luminance + cyan-energy alpha matting yields seamless floating skull-orb glow (`654×619`, trans `41.5%`, core `41.5%`, border `100%`). |
| 35 | `winter_wolf` | Winter Wolf | `LARGE` | `NEWLY_PRODUCED_VERIFIED` | `FIXED_AND_REVERIFIED` | **Severe defect:** Large transparent hole through white chest/ribs and missing lower paws. | **100% Fixed:** Solid white arctic fur body (`48.3%` opaque core) with crisp paws, tail, and snarling jaws (`831×776`, trans `51.0%`, border `100%`). |
| 36 | `wraith` | Wraith | `MEDIUM` | `NEWLY_PRODUCED_VERIFIED` | `FIXED_AND_REVERIFIED` | **Severe defect:** Massive black trapezoidal tomb background block around spectral figure. | **100% Fixed:** Clean tattered spectral robe, clawed hands, and glowing red eyes (`723×972`, trans `58.3%`, core `40.3%`, border `100%`). |
| 37 | `wyvern` | Wyvern | `LARGE` | `NEWLY_PRODUCED_VERIFIED` | `FIXED_AND_REVERIFIED` | Polygonal brown sky/cliff blocks under wings and around barbed tail. | Clean bat-wings, barbed scorpion stinger tail, and talons with cliff rock trimmed (`905×934`, trans `59.0%`, core `40.1%`, border `100%`). |
