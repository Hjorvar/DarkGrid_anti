# Track 4 — Complete Monster Artwork Inventory & RGBA Cutout Production Report

**Date:** 2026-10-20  
**Track:** Track 4 — Complete Monster Artwork Production Lead  
**Scope:** Strictly isolated to `action-ui-lab/` (`public/images/monsters-cutout/*`, `monster-artwork-inventory.json`, `scripts/produce-monster-cutouts.js`, `tests/monster-artwork.test.js`, `docs/overnight/04-monster-artwork-report.md`)  
**Automated Verification:** `node --test action-ui-lab/tests/monster-artwork.test.js` → **4 / 4 passing (0 failures)** ✅

---

## 1. Executive Summary

- **Canonical 98-Monster Audit Completed:** Audited all **98 database monsters** (**68 Core** from seeds `002–006` + **30 Expansion** from seed `010`) defined in `MONSTER_SIZE_CATALOG`, plus **5 PF1e Size Reference Specimens** (`ref_*`) documented separately as non-database reference entries.
- **Binary Format & Source Integrity Discovery:** Every single one of the 98 monsters has both an active painting (`public/images/monsters/<slug>.png`) and a defeated painting (`public/images/monsters/<slug>_defeated.png`) at `1024×1024` resolution (`98/98` verified). Binary header inspection revealed that **38 active paintings are true PNG (`89 50 4E 47`)** while **60 active paintings are JPEG-encoded streams (`FF D8 FF`) stored with a `.png` extension** (`JPEG_IN_PNG`). Zero original monster paintings were modified.
- **RGBA Cutout Production (`7 → 37` Verified Cutouts):**
  - Preserved all **7 baseline approved cutouts** (`assassin_vine`, `ghoul`, `giant_spider`, `manticore`, `skeletal_champion`, `troll`, `wolf`) untouched (`EXISTING_APPROVED`).
  - Produced and validated **30 new Priority Tier 1 RGBA cutouts** (`NEWLY_PRODUCED_VERIFIED`), bringing total verified RGBA cutouts to **37 / 98 (37.8% catalog coverage)**—exceeding the Track 4 target of 22–32+ total cutouts.
  - Retained **61 complex multi-depth painted scene monsters** on safe adaptive `CARD` presentation (`CARD_FALLBACK_RETAINED`) with complete `cardContentBounds` and extraction specifications.

---

## 2. Hybrid RGBA Cutout Extraction & Strict Quality Gate Methodology

### 2.1 Five-Stage Hybrid Extraction Pipeline (`action-ui-lab/scripts/produce-monster-cutouts.js`)
Because 60 of the 98 source `.png` files are JPEG-encoded (`JPEG_IN_PNG`), our local pipeline uses Python `Pillow` (`PIL`) for format-agnostic decoding combined with a 5-stage anatomical & chromatic matting pipeline:
1. **Anatomical Multi-Polygon Trimap Construction:** Each Priority Tier 1 creature is mapped with normalized `[0..1]` anatomical outer envelopes (`polys` covering head, horns/ears, torso, limbs, wings, weapons, and tails while excluding outer framing trees, pillars, and background statues), negative-space gap seeds (`gaps` between legs, under arms, inside coils), and inner spine/body cores (`cores`).
2. **Chromatic & Luminance Mist Discrimination:** Separates creature foreground (warm brown/tan/gold/crimson/amber `WARM_CREATURE` / `WARM_STRONG`, olive/emerald scales `GREEN_SCALES` where `G > B` and `R >= B - 4`, arctic fur `BRIGHT_ICE`, luminous plasma `CYAN_ORB`, or dark spectral shroud `DARK_SPECTER`) from the cool blue-grey/teal atmospheric fog (`B >= R - 2`, low saturation) characteristic of the Darkgrid art style. A 5px morphological dilation of the primary chromatic body preserves attached dark inked outlines (`lum < 44`).
3. **Core-Seeded Connected-Component Filtering:** Runs breadth-first connected-component labeling seeded from the creature core so any detached background stone, branch, or mist island is 100% eliminated.
4. **Morphological Pinhole Closing, Gaussian Edge Feathering & RGB Despill:** Closes micro-pinholes (`MaxFilter(5) -> MinFilter(5)`), applies a `1.8px` Gaussian alpha ramp for anti-aliased silhouette edges, and despills semi-transparent edge pixels (`0 < alpha < 225`) by clamping cool blue channel spill and darkening toward the inked outline.
5. **Tight Bounding-Box Crop + 12px Transparent Margin:** Matches the exact convention of the 7 baseline cutouts in `MONSTER_SIZE_CATALOG` by cropping tightly to the `alpha > 20` bounding box and adding a uniform `12px` transparent border on all 4 sides, ensuring `borderTransparencyRatio === 1.000` and accurate ground-shadow foot anchoring in `computeAdaptiveMonsterVisualScale()`.

### 2.2 Strict Pixel-Level Quality Gate (`validateCutoutRgbaBuffer`)
Every existing and newly produced cutout in `action-ui-lab/public/images/monsters-cutout/<slug>.png` must pass all 6 automated pixel-level checks:
1. **True RGBA PNG Header:** Valid PNG signature (`89 50 4E 47`) and `IHDR` with `bitDepth === 8` and `colorType === 6` (4-channel RGBA).
2. **Background Removal Ratio:** `0.15 <= transparentPixelRatio <= 0.88` (pixels with `alpha <= 20`).
3. **Solid Creature Core Integrity:** `opaqueCoreRatio >= 0.10` (pixels with `alpha >= 220`).
4. **Outer Border Cleanliness:** `borderTransparencyRatio >= 0.85` on the outer 2px perimeter (`100.0%` achieved across all 37 cutouts).
5. **Silhouette Completeness:** `contentWidthRatio >= 0.35` and `contentHeightRatio >= 0.35`.
6. **Centered Center-of-Mass:** Alpha-weighted center of mass within `[0.25, 0.75]` on both X and Y axes.

---

## 3. Verified RGBA Cutouts Summary (37 Approved Cutouts: 7 Baseline + 30 New Priority Tier 1)

| # | ID | Slug | Name | PF1e Size | Body Profile | Status | Cutout Dim | Transparent % | Opaque Core % | Border Clean % | Content Bounds (`minX,minY → maxX,maxY`) |
|---:|---:|:-----|:-----|:----------|:-------------|:-------|:----------:|--------------:|--------------:|---------------:|:----------------------------------------:|
| 1 | 1 | `assassin_vine` | Assassin Vine | `LARGE` | `PLANT_MASS_LARGE` | `EXISTING_APPROVED` | `796×885` | 52.8% | 42.7% | 100.0% | `12,12 → 783,872` (0.9698×0.9729) |
| 2 | 4 | `wolf` | Wolf | `MEDIUM` | `QUADRUPED_LOW` | `EXISTING_APPROVED` | `827×777` | 53.0% | 45.2% | 100.0% | `12,12 → 814,764` (0.971×0.9691) |
| 3 | 5 | `troll` | Troll | `LARGE` | `BIPED_TALL_BRUTE` | `EXISTING_APPROVED` | `643×860` | 42.6% | 56.5% | 100.0% | `3,3 → 639,856` (0.9907×0.993) |
| 4 | 126 | `ghoul` | Ghoul | `MEDIUM` | `BIPED_CROUCHED` | `EXISTING_APPROVED` | `783×706` | 59.9% | 37.7% | 100.0% | `12,12 → 770,693` (0.9693×0.966) |
| 5 | 127 | `giant_spider` | Giant Spider | `MEDIUM` | `ARACHNID_WIDE` | `EXISTING_APPROVED` | `860×570` | 68.4% | 30.4% | 100.0% | `3,4 → 856,565` (0.993×0.986) |
| 7 | 129 | `rust_monster` | Rust Monster | `MEDIUM` | `ARACHNID_WIDE` | `NEWLY_PRODUCED_VERIFIED` | `812×852` | 58.0% | 35.2% | 100.0% | `12,12 → 799,839` (0.9704×0.9718) |
| 8 | 130 | `manticore` | Manticore | `LARGE` | `WINGED_LARGE_PREDATOR` | `EXISTING_APPROVED` | `1022×845` | 66.9% | 32.5% | 100.0% | `16,16 → 1009,828` (0.9726×0.9621) |
| 9 | 495 | `kobold` | Kobold | `SMALL` | `BIPED_SMALL` | `NEWLY_PRODUCED_VERIFIED` | `599×620` | 61.6% | 30.8% | 100.0% | `12,12 → 586,607` (0.9599×0.9613) |
| 10 | 496 | `goblin` | Goblin | `SMALL` | `BIPED_SMALL` | `NEWLY_PRODUCED_VERIFIED` | `701×873` | 61.2% | 33.5% | 100.0% | `12,12 → 688,860` (0.9658×0.9725) |
| 11 | 497 | `human_skeleton` | Human Skeleton | `MEDIUM` | `BIPED_MEDIUM` | `NEWLY_PRODUCED_VERIFIED` | `779×919` | 76.6% | 17.3% | 100.0% | `12,12 → 766,906` (0.9692×0.9739) |
| 13 | 499 | `human_zombie` | Human Zombie | `MEDIUM` | `BIPED_CROUCHED` | `NEWLY_PRODUCED_VERIFIED` | `618×896` | 64.9% | 28.1% | 100.0% | `12,12 → 605,883` (0.9612×0.9732) |
| 16 | 502 | `lizardfolk` | Lizardfolk | `MEDIUM` | `BIPED_HEAVY_MEDIUM` | `NEWLY_PRODUCED_VERIFIED` | `883×906` | 51.9% | 39.0% | 100.0% | `12,12 → 870,893` (0.9728×0.9735) |
| 18 | 504 | `gnoll` | Gnoll | `MEDIUM` | `BIPED_HEAVY_MEDIUM` | `NEWLY_PRODUCED_VERIFIED` | `878×905` | 48.1% | 46.9% | 100.0% | `12,12 → 865,892` (0.9727×0.9735) |
| 22 | 508 | `bugbear` | Bugbear | `MEDIUM` | `BIPED_HEAVY_MEDIUM` | `NEWLY_PRODUCED_VERIFIED` | `668×916` | 39.3% | 54.2% | 100.0% | `12,12 → 655,903` (0.9641×0.9738) |
| 25 | 511 | `giant_crab` | Giant Crab | `MEDIUM` | `ARACHNID_WIDE` | `NEWLY_PRODUCED_VERIFIED` | `767×810` | 57.0% | 35.1% | 100.0% | `12,12 → 754,797` (0.9687×0.9704) |
| 28 | 514 | `ankheg` | Ankheg | `LARGE` | `ARACHNID_CHITIN_LARGE` | `NEWLY_PRODUCED_VERIFIED` | `683×865` | 39.6% | 52.1% | 100.0% | `12,12 → 670,852` (0.9649×0.9723) |
| 29 | 515 | `ogre` | Ogre | `LARGE` | `BIPED_TALL_BRUTE` | `NEWLY_PRODUCED_VERIFIED` | `840×993` | 52.9% | 42.6% | 100.0% | `12,12 → 827,980` (0.9714×0.9758) |
| 30 | 516 | `shadow` | Shadow | `MEDIUM` | `INCORPOREAL_FLOAT` | `NEWLY_PRODUCED_VERIFIED` | `378×764` | 63.7% | 22.2% | 100.0% | `12,12 → 365,751` (0.9365×0.9686) |
| 31 | 517 | `owlbear` | Owlbear | `LARGE` | `QUADRUPED_MASSIVE` | `NEWLY_PRODUCED_VERIFIED` | `695×850` | 38.6% | 52.3% | 100.0% | `12,12 → 682,837` (0.9655×0.9718) |
| 32 | 518 | `minotaur` | Minotaur | `LARGE` | `BIPED_TALL_BRUTE` | `NEWLY_PRODUCED_VERIFIED` | `803×925` | 45.0% | 47.0% | 100.0% | `12,12 → 790,912` (0.9701×0.9741) |
| 34 | 520 | `gargoyle` | Gargoyle | `MEDIUM` | `WINGED_HOVER_MEDIUM` | `NEWLY_PRODUCED_VERIFIED` | `793×903` | 29.4% | 65.0% | 100.0% | `12,12 → 780,890` (0.9697×0.9734) |
| 35 | 521 | `basilisk` | Basilisk | `MEDIUM` | `QUADRUPED_LOW` | `NEWLY_PRODUCED_VERIFIED` | `871×583` | 48.8% | 46.5% | 100.0% | `12,12 → 858,570` (0.9724×0.9588) |
| 36 | 522 | `mummy` | Mummy | `MEDIUM` | `BIPED_MEDIUM` | `NEWLY_PRODUCED_VERIFIED` | `726×930` | 64.8% | 28.7% | 100.0% | `12,12 → 713,917` (0.9669×0.9742) |
| 37 | 523 | `ochre_jelly` | Ochre Jelly | `LARGE` | `AMORPHOUS_LARGE_OOZE` | `NEWLY_PRODUCED_VERIFIED` | `956×803` | 36.0% | 55.0% | 100.0% | `12,12 → 943,790` (0.9749×0.9701) |
| 38 | 524 | `winter_wolf` | Winter Wolf | `LARGE` | `QUADRUPED_MASSIVE` | `NEWLY_PRODUCED_VERIFIED` | `844×791` | 49.2% | 41.9% | 100.0% | `12,12 → 831,778` (0.9716×0.9697) |
| 39 | 2691 | `stirge` | Stirge | `TINY` | `WINGED_TINY_PEST` | `NEWLY_PRODUCED_VERIFIED` | `688×807` | 69.3% | 22.4% | 100.0% | `12,12 → 675,794` (0.9651×0.9703) |
| 40 | 2692 | `dire_rat` | Dire Rat | `SMALL` | `QUADRUPED_SMALL_LOW` | `NEWLY_PRODUCED_VERIFIED` | `842×658` | 46.9% | 45.9% | 100.0% | `12,12 → 829,645` (0.9715×0.9635) |
| 41 | 2693 | `viper` | Viper | `TINY` | `SERPENTINE_TINY` | `NEWLY_PRODUCED_VERIFIED` | `807×857` | 48.9% | 44.8% | 100.0% | `12,12 → 794,844` (0.9703×0.972) |
| 44 | 2696 | `skeletal_champion` | Skeletal Champion | `MEDIUM` | `BIPED_MEDIUM` | `EXISTING_APPROVED` | `579×860` | 52.1% | 46.9% | 100.0% | `3,3 → 575,856` (0.9896×0.993) |
| 48 | 2700 | `orc` | Orc | `MEDIUM` | `BIPED_HEAVY_MEDIUM` | `NEWLY_PRODUCED_VERIFIED` | `666×906` | 33.2% | 57.6% | 100.0% | `12,12 → 653,893` (0.964×0.9735) |
| 50 | 2702 | `harpy` | Harpy | `MEDIUM` | `WINGED_HOVER_MEDIUM` | `NEWLY_PRODUCED_VERIFIED` | `832×894` | 40.1% | 49.9% | 100.0% | `12,12 → 819,881` (0.9712×0.9732) |
| 52 | 2704 | `griffon` | Griffon | `LARGE` | `WINGED_LARGE_PREDATOR` | `NEWLY_PRODUCED_VERIFIED` | `812×870` | 33.9% | 55.7% | 100.0% | `12,12 → 799,857` (0.9704×0.9724) |
| 53 | 2705 | `giant_scorpion` | Giant Scorpion | `LARGE` | `ARACHNID_CHITIN_LARGE` | `NEWLY_PRODUCED_VERIFIED` | `842×895` | 32.1% | 62.8% | 100.0% | `12,12 → 829,882` (0.9715×0.9732) |
| 56 | 2708 | `wraith` | Wraith | `MEDIUM` | `INCORPOREAL_FLOAT` | `NEWLY_PRODUCED_VERIFIED` | `752×905` | 23.0% | 71.5% | 100.0% | `12,12 → 739,892` (0.9681×0.9735) |
| 71 | 9145 | `blood_hawk` | Blood Hawk | `TINY` | `WINGED_TINY_RAPTOR` | `NEWLY_PRODUCED_VERIFIED` | `750×749` | 61.6% | 31.0% | 100.0% | `12,12 → 737,736` (0.968×0.968) |
| 83 | 9157 | `will_o_wisp` | Will-o'-Wisp | `SMALL` | `FLOATING_ORB` | `NEWLY_PRODUCED_VERIFIED` | `603×606` | 28.2% | 54.7% | 100.0% | `12,12 → 590,593` (0.9602×0.9604) |
| 93 | 9167 | `wyvern` | Wyvern | `LARGE` | `WINGED_LARGE_PREDATOR` | `NEWLY_PRODUCED_VERIFIED` | `944×953` | 53.4% | 41.2% | 100.0% | `12,12 → 931,940` (0.9746×0.9748) |

---

## 4. Complete 98-Monster Artwork Inventory & Status Table

| Order | DB ID | Batch | Slug | Name | CR | PF1e Size | Body Profile | Source Format | Cutout Status | Fallback Mode | Validation Metrics / Notes |
|------:|------:|:------|:-----|:-----|---:|:----------|:-------------|:-------------:|:--------------|:-------------:|:---------------------------|
| 1 | 1 | `CORE_68` | `assassin_vine` | Assassin Vine | 3 | `LARGE` | `PLANT_MASS_LARGE` | `PNG` | `EXISTING_APPROVED` | `INTEGRATED` | Verified RGBA cutout (796x885, transparent=52.8%, borderClean=100.0%) |
| 2 | 4 | `CORE_68` | `wolf` | Wolf | 1 | `MEDIUM` | `QUADRUPED_LOW` | `PNG` | `EXISTING_APPROVED` | `INTEGRATED` | Verified RGBA cutout (827x777, transparent=53.0%, borderClean=100.0%) |
| 3 | 5 | `CORE_68` | `troll` | Troll | 5 | `LARGE` | `BIPED_TALL_BRUTE` | `PNG` | `EXISTING_APPROVED` | `INTEGRATED` | Verified RGBA cutout (643x860, transparent=42.6%, borderClean=100.0%) |
| 4 | 126 | `CORE_68` | `ghoul` | Ghoul | 1 | `MEDIUM` | `BIPED_CROUCHED` | `PNG` | `EXISTING_APPROVED` | `INTEGRATED` | Verified RGBA cutout (783x706, transparent=59.9%, borderClean=100.0%) |
| 5 | 127 | `CORE_68` | `giant_spider` | Giant Spider | 1 | `MEDIUM` | `ARACHNID_WIDE` | `PNG` | `EXISTING_APPROVED` | `INTEGRATED` | Verified RGBA cutout (860x570, transparent=68.4%, borderClean=100.0%) |
| 6 | 128 | `CORE_68` | `choker` | Choker | 2 | `SMALL` | `BIPED_SMALL_STALKER` | `PNG` | `CARD_FALLBACK_RETAINED` | `CARD` | Complex multi-depth painted scene; retained on safe adaptive CARD presentation for Tier 2/3 batch. |
| 7 | 129 | `CORE_68` | `rust_monster` | Rust Monster | 3 | `MEDIUM` | `ARACHNID_WIDE` | `PNG` | `NEWLY_PRODUCED_VERIFIED` | `INTEGRATED` | Verified RGBA cutout (812x852, transparent=58.0%, borderClean=100.0%) |
| 8 | 130 | `CORE_68` | `manticore` | Manticore | 5 | `LARGE` | `WINGED_LARGE_PREDATOR` | `PNG` | `EXISTING_APPROVED` | `INTEGRATED` | Verified RGBA cutout (1022x845, transparent=66.9%, borderClean=100.0%) |
| 9 | 495 | `CORE_68` | `kobold` | Kobold | 0.25 | `SMALL` | `BIPED_SMALL` | `JPEG_IN_PNG` | `NEWLY_PRODUCED_VERIFIED` | `INTEGRATED` | Verified RGBA cutout (599x620, transparent=61.6%, borderClean=100.0%) |
| 10 | 496 | `CORE_68` | `goblin` | Goblin | 0.33 | `SMALL` | `BIPED_SMALL` | `JPEG_IN_PNG` | `NEWLY_PRODUCED_VERIFIED` | `INTEGRATED` | Verified RGBA cutout (701x873, transparent=61.2%, borderClean=100.0%) |
| 11 | 497 | `CORE_68` | `human_skeleton` | Human Skeleton | 0.33 | `MEDIUM` | `BIPED_MEDIUM` | `JPEG_IN_PNG` | `NEWLY_PRODUCED_VERIFIED` | `INTEGRATED` | Verified RGBA cutout (779x919, transparent=76.6%, borderClean=100.0%) |
| 12 | 498 | `CORE_68` | `hobgoblin` | Hobgoblin | 0.5 | `MEDIUM` | `BIPED_MEDIUM` | `JPEG_IN_PNG` | `CARD_FALLBACK_RETAINED` | `CARD` | Complex multi-depth painted scene; retained on safe adaptive CARD presentation for Tier 2/3 batch. |
| 13 | 499 | `CORE_68` | `human_zombie` | Human Zombie | 0.5 | `MEDIUM` | `BIPED_CROUCHED` | `JPEG_IN_PNG` | `NEWLY_PRODUCED_VERIFIED` | `INTEGRATED` | Verified RGBA cutout (618x896, transparent=64.9%, borderClean=100.0%) |
| 14 | 500 | `CORE_68` | `troglodyte` | Troglodyte | 1 | `MEDIUM` | `BIPED_MEDIUM` | `JPEG_IN_PNG` | `CARD_FALLBACK_RETAINED` | `CARD` | Complex multi-depth painted scene; retained on safe adaptive CARD presentation for Tier 2/3 batch. |
| 15 | 501 | `CORE_68` | `darkmantle` | Darkmantle | 1 | `SMALL` | `AMORPHOUS_SMALL_LURKER` | `JPEG_IN_PNG` | `CARD_FALLBACK_RETAINED` | `CARD` | Complex multi-depth painted scene; retained on safe adaptive CARD presentation for Tier 2/3 batch. |
| 16 | 502 | `CORE_68` | `lizardfolk` | Lizardfolk | 1 | `MEDIUM` | `BIPED_HEAVY_MEDIUM` | `JPEG_IN_PNG` | `NEWLY_PRODUCED_VERIFIED` | `INTEGRATED` | Verified RGBA cutout (883x906, transparent=51.9%, borderClean=100.0%) |
| 17 | 503 | `CORE_68` | `hyena` | Hyena | 1 | `MEDIUM` | `QUADRUPED_LOW` | `JPEG_IN_PNG` | `CARD_FALLBACK_RETAINED` | `CARD` | Complex multi-depth painted scene; retained on safe adaptive CARD presentation for Tier 2/3 batch. |
| 18 | 504 | `CORE_68` | `gnoll` | Gnoll | 1 | `MEDIUM` | `BIPED_HEAVY_MEDIUM` | `JPEG_IN_PNG` | `NEWLY_PRODUCED_VERIFIED` | `INTEGRATED` | Verified RGBA cutout (878x905, transparent=48.1%, borderClean=100.0%) |
| 19 | 505 | `CORE_68` | `giant_frog` | Giant Frog | 1 | `MEDIUM` | `QUADRUPED_LOW` | `JPEG_IN_PNG` | `CARD_FALLBACK_RETAINED` | `CARD` | Complex multi-depth painted scene; retained on safe adaptive CARD presentation for Tier 2/3 batch. |
| 20 | 506 | `CORE_68` | `boar` | Boar | 2 | `MEDIUM` | `QUADRUPED_LOW` | `JPEG_IN_PNG` | `CARD_FALLBACK_RETAINED` | `CARD` | Complex multi-depth painted scene; retained on safe adaptive CARD presentation for Tier 2/3 batch. |
| 21 | 507 | `CORE_68` | `yellow_musk_creeper` | Yellow Musk Creeper | 2 | `MEDIUM` | `PLANT_MASS_MEDIUM` | `JPEG_IN_PNG` | `CARD_FALLBACK_RETAINED` | `CARD` | Complex multi-depth painted scene; retained on safe adaptive CARD presentation for Tier 2/3 batch. |
| 22 | 508 | `CORE_68` | `bugbear` | Bugbear | 2 | `MEDIUM` | `BIPED_HEAVY_MEDIUM` | `JPEG_IN_PNG` | `NEWLY_PRODUCED_VERIFIED` | `INTEGRATED` | Verified RGBA cutout (668x916, transparent=39.3%, borderClean=100.0%) |
| 23 | 509 | `CORE_68` | `boggard` | Boggard | 2 | `MEDIUM` | `BIPED_HEAVY_MEDIUM` | `JPEG_IN_PNG` | `CARD_FALLBACK_RETAINED` | `CARD` | Complex multi-depth painted scene; retained on safe adaptive CARD presentation for Tier 2/3 batch. |
| 24 | 510 | `CORE_68` | `death_dog` | Death Dog | 2 | `MEDIUM` | `QUADRUPED_LOW` | `JPEG_IN_PNG` | `CARD_FALLBACK_RETAINED` | `CARD` | Complex multi-depth painted scene; retained on safe adaptive CARD presentation for Tier 2/3 batch. |
| 25 | 511 | `CORE_68` | `giant_crab` | Giant Crab | 2 | `MEDIUM` | `ARACHNID_WIDE` | `JPEG_IN_PNG` | `NEWLY_PRODUCED_VERIFIED` | `INTEGRATED` | Verified RGBA cutout (767x810, transparent=57.0%, borderClean=100.0%) |
| 26 | 512 | `CORE_68` | `ettercap` | Ettercap | 3 | `MEDIUM` | `BIPED_CROUCHED` | `JPEG_IN_PNG` | `CARD_FALLBACK_RETAINED` | `CARD` | Complex multi-depth painted scene; retained on safe adaptive CARD presentation for Tier 2/3 batch. |
| 27 | 513 | `CORE_68` | `cockatrice` | Cockatrice | 3 | `SMALL` | `AVIAN_SMALL_RUNNER` | `JPEG_IN_PNG` | `CARD_FALLBACK_RETAINED` | `CARD` | Complex multi-depth painted scene; retained on safe adaptive CARD presentation for Tier 2/3 batch. |
| 28 | 514 | `CORE_68` | `ankheg` | Ankheg | 3 | `LARGE` | `ARACHNID_CHITIN_LARGE` | `JPEG_IN_PNG` | `NEWLY_PRODUCED_VERIFIED` | `INTEGRATED` | Verified RGBA cutout (683x865, transparent=39.6%, borderClean=100.0%) |
| 29 | 515 | `CORE_68` | `ogre` | Ogre | 3 | `LARGE` | `BIPED_TALL_BRUTE` | `JPEG_IN_PNG` | `NEWLY_PRODUCED_VERIFIED` | `INTEGRATED` | Verified RGBA cutout (840x993, transparent=52.9%, borderClean=100.0%) |
| 30 | 516 | `CORE_68` | `shadow` | Shadow | 3 | `MEDIUM` | `INCORPOREAL_FLOAT` | `JPEG_IN_PNG` | `NEWLY_PRODUCED_VERIFIED` | `INTEGRATED` | Verified RGBA cutout (378x764, transparent=63.7%, borderClean=100.0%) |
| 31 | 517 | `CORE_68` | `owlbear` | Owlbear | 4 | `LARGE` | `QUADRUPED_MASSIVE` | `JPEG_IN_PNG` | `NEWLY_PRODUCED_VERIFIED` | `INTEGRATED` | Verified RGBA cutout (695x850, transparent=38.6%, borderClean=100.0%) |
| 32 | 518 | `CORE_68` | `minotaur` | Minotaur | 4 | `LARGE` | `BIPED_TALL_BRUTE` | `JPEG_IN_PNG` | `NEWLY_PRODUCED_VERIFIED` | `INTEGRATED` | Verified RGBA cutout (803x925, transparent=45.0%, borderClean=100.0%) |
| 33 | 519 | `CORE_68` | `yeti` | Yeti | 4 | `LARGE` | `BIPED_TALL_BRUTE` | `JPEG_IN_PNG` | `CARD_FALLBACK_RETAINED` | `CARD` | Complex multi-depth painted scene; retained on safe adaptive CARD presentation for Tier 2/3 batch. |
| 34 | 520 | `CORE_68` | `gargoyle` | Gargoyle | 4 | `MEDIUM` | `WINGED_HOVER_MEDIUM` | `JPEG_IN_PNG` | `NEWLY_PRODUCED_VERIFIED` | `INTEGRATED` | Verified RGBA cutout (793x903, transparent=29.4%, borderClean=100.0%) |
| 35 | 521 | `CORE_68` | `basilisk` | Basilisk | 5 | `MEDIUM` | `QUADRUPED_LOW` | `JPEG_IN_PNG` | `NEWLY_PRODUCED_VERIFIED` | `INTEGRATED` | Verified RGBA cutout (871x583, transparent=48.8%, borderClean=100.0%) |
| 36 | 522 | `CORE_68` | `mummy` | Mummy | 5 | `MEDIUM` | `BIPED_MEDIUM` | `JPEG_IN_PNG` | `NEWLY_PRODUCED_VERIFIED` | `INTEGRATED` | Verified RGBA cutout (726x930, transparent=64.8%, borderClean=100.0%) |
| 37 | 523 | `CORE_68` | `ochre_jelly` | Ochre Jelly | 5 | `LARGE` | `AMORPHOUS_LARGE_OOZE` | `JPEG_IN_PNG` | `NEWLY_PRODUCED_VERIFIED` | `INTEGRATED` | Verified RGBA cutout (956x803, transparent=36.0%, borderClean=100.0%) |
| 38 | 524 | `CORE_68` | `winter_wolf` | Winter Wolf | 5 | `LARGE` | `QUADRUPED_MASSIVE` | `JPEG_IN_PNG` | `NEWLY_PRODUCED_VERIFIED` | `INTEGRATED` | Verified RGBA cutout (844x791, transparent=49.2%, borderClean=100.0%) |
| 39 | 2691 | `CORE_68` | `stirge` | Stirge | 0.5 | `TINY` | `WINGED_TINY_PEST` | `PNG` | `NEWLY_PRODUCED_VERIFIED` | `INTEGRATED` | Verified RGBA cutout (688x807, transparent=69.3%, borderClean=100.0%) |
| 40 | 2692 | `CORE_68` | `dire_rat` | Dire Rat | 0.33 | `SMALL` | `QUADRUPED_SMALL_LOW` | `PNG` | `NEWLY_PRODUCED_VERIFIED` | `INTEGRATED` | Verified RGBA cutout (842x658, transparent=46.9%, borderClean=100.0%) |
| 41 | 2693 | `CORE_68` | `viper` | Viper | 0.5 | `TINY` | `SERPENTINE_TINY` | `PNG` | `NEWLY_PRODUCED_VERIFIED` | `INTEGRATED` | Verified RGBA cutout (807x857, transparent=48.9%, borderClean=100.0%) |
| 42 | 2694 | `CORE_68` | `giant_centipede` | Giant Centipede | 0.5 | `MEDIUM` | `SERPENTINE_COILED` | `PNG` | `CARD_FALLBACK_RETAINED` | `CARD` | Complex multi-depth painted scene; retained on safe adaptive CARD presentation for Tier 2/3 batch. |
| 43 | 2695 | `CORE_68` | `iron_cobra` | Iron Cobra | 2 | `SMALL` | `SERPENTINE_SMALL_COILED` | `PNG` | `CARD_FALLBACK_RETAINED` | `CARD` | Complex multi-depth painted scene; retained on safe adaptive CARD presentation for Tier 2/3 batch. |
| 44 | 2696 | `CORE_68` | `skeletal_champion` | Skeletal Champion | 2 | `MEDIUM` | `BIPED_MEDIUM` | `PNG` | `EXISTING_APPROVED` | `INTEGRATED` | Verified RGBA cutout (579x860, transparent=52.1%, borderClean=100.0%) |
| 45 | 2697 | `CORE_68` | `blink_dog` | Blink Dog | 2 | `MEDIUM` | `QUADRUPED_LOW` | `PNG` | `CARD_FALLBACK_RETAINED` | `CARD` | Complex multi-depth painted scene; retained on safe adaptive CARD presentation for Tier 2/3 batch. |
| 46 | 2698 | `CORE_68` | `duergar` | Duergar | 0.33 | `MEDIUM` | `BIPED_STOCKY_MEDIUM` | `PNG` | `CARD_FALLBACK_RETAINED` | `CARD` | Complex multi-depth painted scene; retained on safe adaptive CARD presentation for Tier 2/3 batch. |
| 47 | 2699 | `CORE_68` | `drow` | Drow | 0.33 | `MEDIUM` | `BIPED_MEDIUM` | `PNG` | `CARD_FALLBACK_RETAINED` | `CARD` | Complex multi-depth painted scene; retained on safe adaptive CARD presentation for Tier 2/3 batch. |
| 48 | 2700 | `CORE_68` | `orc` | Orc | 0.33 | `MEDIUM` | `BIPED_HEAVY_MEDIUM` | `PNG` | `NEWLY_PRODUCED_VERIFIED` | `INTEGRATED` | Verified RGBA cutout (666x906, transparent=33.2%, borderClean=100.0%) |
| 49 | 2701 | `CORE_68` | `wight` | Wight | 3 | `MEDIUM` | `BIPED_MEDIUM` | `PNG` | `CARD_FALLBACK_RETAINED` | `CARD` | Complex multi-depth painted scene; retained on safe adaptive CARD presentation for Tier 2/3 batch. |
| 50 | 2702 | `CORE_68` | `harpy` | Harpy | 4 | `MEDIUM` | `WINGED_HOVER_MEDIUM` | `PNG` | `NEWLY_PRODUCED_VERIFIED` | `INTEGRATED` | Verified RGBA cutout (832x894, transparent=40.1%, borderClean=100.0%) |
| 51 | 2703 | `CORE_68` | `doppelganger` | Doppelganger | 3 | `MEDIUM` | `BIPED_MEDIUM` | `PNG` | `CARD_FALLBACK_RETAINED` | `CARD` | Complex multi-depth painted scene; retained on safe adaptive CARD presentation for Tier 2/3 batch. |
| 52 | 2704 | `CORE_68` | `griffon` | Griffon | 4 | `LARGE` | `WINGED_LARGE_PREDATOR` | `PNG` | `NEWLY_PRODUCED_VERIFIED` | `INTEGRATED` | Verified RGBA cutout (812x870, transparent=33.9%, borderClean=100.0%) |
| 53 | 2705 | `CORE_68` | `giant_scorpion` | Giant Scorpion | 3 | `LARGE` | `ARACHNID_CHITIN_LARGE` | `PNG` | `NEWLY_PRODUCED_VERIFIED` | `INTEGRATED` | Verified RGBA cutout (842x895, transparent=32.1%, borderClean=100.0%) |
| 54 | 2706 | `CORE_68` | `cloaker` | Cloaker | 5 | `LARGE` | `WINGED_LARGE_PREDATOR` | `PNG` | `CARD_FALLBACK_RETAINED` | `CARD` | Complex multi-depth painted scene; retained on safe adaptive CARD presentation for Tier 2/3 batch. |
| 55 | 2707 | `CORE_68` | `phase_spider` | Phase Spider | 5 | `LARGE` | `ARACHNID_CHITIN_LARGE` | `PNG` | `CARD_FALLBACK_RETAINED` | `CARD` | Complex multi-depth painted scene; retained on safe adaptive CARD presentation for Tier 2/3 batch. |
| 56 | 2708 | `CORE_68` | `wraith` | Wraith | 5 | `MEDIUM` | `INCORPOREAL_FLOAT` | `PNG` | `NEWLY_PRODUCED_VERIFIED` | `INTEGRATED` | Verified RGBA cutout (752x905, transparent=23.0%, borderClean=100.0%) |
| 57 | 2709 | `CORE_68` | `gibbering_mouther` | Gibbering Mouther | 5 | `MEDIUM` | `AMORPHOUS_MEDIUM_OOZE` | `PNG` | `CARD_FALLBACK_RETAINED` | `CARD` | Complex multi-depth painted scene; retained on safe adaptive CARD presentation for Tier 2/3 batch. |
| 58 | 2710 | `CORE_68` | `peryton` | Peryton | 4 | `MEDIUM` | `WINGED_HOVER_MEDIUM` | `PNG` | `CARD_FALLBACK_RETAINED` | `CARD` | Complex multi-depth painted scene; retained on safe adaptive CARD presentation for Tier 2/3 batch. |
| 59 | 2711 | `CORE_68` | `giant_stag_beetle` | Giant Stag Beetle | 4 | `LARGE` | `ARACHNID_CHITIN_LARGE` | `PNG` | `CARD_FALLBACK_RETAINED` | `CARD` | Complex multi-depth painted scene; retained on safe adaptive CARD presentation for Tier 2/3 batch. |
| 60 | 2712 | `CORE_68` | `vegepygmy` | Vegepygmy | 0.5 | `SMALL` | `BIPED_SMALL` | `PNG` | `CARD_FALLBACK_RETAINED` | `CARD` | Complex multi-depth painted scene; retained on safe adaptive CARD presentation for Tier 2/3 batch. |
| 61 | 2713 | `CORE_68` | `ghast` | Ghast | 2 | `MEDIUM` | `BIPED_CROUCHED` | `PNG` | `CARD_FALLBACK_RETAINED` | `CARD` | Complex multi-depth painted scene; retained on safe adaptive CARD presentation for Tier 2/3 batch. |
| 62 | 2714 | `CORE_68` | `giant_bat` | Giant Bat | 2 | `LARGE` | `WINGED_LARGE_PREDATOR` | `PNG` | `CARD_FALLBACK_RETAINED` | `CARD` | Complex multi-depth painted scene; retained on safe adaptive CARD presentation for Tier 2/3 batch. |
| 63 | 2715 | `CORE_68` | `morlock` | Morlock | 2 | `MEDIUM` | `BIPED_CROUCHED` | `PNG` | `CARD_FALLBACK_RETAINED` | `CARD` | Complex multi-depth painted scene; retained on safe adaptive CARD presentation for Tier 2/3 batch. |
| 64 | 2716 | `CORE_68` | `violet_fungus` | Violet Fungus | 3 | `MEDIUM` | `PLANT_MASS_MEDIUM` | `PNG` | `CARD_FALLBACK_RETAINED` | `CARD` | Complex multi-depth painted scene; retained on safe adaptive CARD presentation for Tier 2/3 batch. |
| 65 | 2717 | `CORE_68` | `grick` | Grick | 2 | `MEDIUM` | `SERPENTINE_COILED` | `PNG` | `CARD_FALLBACK_RETAINED` | `CARD` | Complex multi-depth painted scene; retained on safe adaptive CARD presentation for Tier 2/3 batch. |
| 66 | 2718 | `CORE_68` | `krenshar` | Krenshar | 1 | `MEDIUM` | `QUADRUPED_LOW` | `PNG` | `CARD_FALLBACK_RETAINED` | `CARD` | Complex multi-depth painted scene; retained on safe adaptive CARD presentation for Tier 2/3 batch. |
| 67 | 2719 | `CORE_68` | `bunyip` | Bunyip | 3 | `MEDIUM` | `QUADRUPED_LOW` | `PNG` | `CARD_FALLBACK_RETAINED` | `CARD` | Complex multi-depth painted scene; retained on safe adaptive CARD presentation for Tier 2/3 batch. |
| 68 | 2720 | `CORE_68` | `sahuagin` | Sahuagin | 2 | `MEDIUM` | `BIPED_HEAVY_MEDIUM` | `PNG` | `CARD_FALLBACK_RETAINED` | `CARD` | Complex multi-depth painted scene; retained on safe adaptive CARD presentation for Tier 2/3 batch. |
| 69 | 9143 | `SEED_010_EXPANSION` | `mite` | Mite | 0.25 | `SMALL` | `BIPED_SMALL` | `JPEG_IN_PNG` | `CARD_FALLBACK_RETAINED` | `CARD` | Complex multi-depth painted scene; retained on safe adaptive CARD presentation for Tier 2/3 batch. |
| 70 | 9144 | `SEED_010_EXPANSION` | `bog_strider` | Bog Strider | 0.5 | `SMALL` | `ARACHNID_SMALL_SKIMMER` | `JPEG_IN_PNG` | `CARD_FALLBACK_RETAINED` | `CARD` | Complex multi-depth painted scene; retained on safe adaptive CARD presentation for Tier 2/3 batch. |
| 71 | 9145 | `SEED_010_EXPANSION` | `blood_hawk` | Blood Hawk | 0.5 | `TINY` | `WINGED_TINY_RAPTOR` | `JPEG_IN_PNG` | `NEWLY_PRODUCED_VERIFIED` | `INTEGRATED` | Verified RGBA cutout (750x749, transparent=61.6%, borderClean=100.0%) |
| 72 | 9146 | `SEED_010_EXPANSION` | `jungle_viper` | Jungle Viper | 0.5 | `TINY` | `SERPENTINE_TINY` | `JPEG_IN_PNG` | `CARD_FALLBACK_RETAINED` | `CARD` | Complex multi-depth painted scene; retained on safe adaptive CARD presentation for Tier 2/3 batch. |
| 73 | 9147 | `SEED_010_EXPANSION` | `plague_zombie` | Plague Zombie | 0.5 | `MEDIUM` | `BIPED_CROUCHED` | `JPEG_IN_PNG` | `CARD_FALLBACK_RETAINED` | `CARD` | Complex multi-depth painted scene; retained on safe adaptive CARD presentation for Tier 2/3 batch. |
| 74 | 9148 | `SEED_010_EXPANSION` | `grippli_scout` | Grippli Scout | 0.5 | `SMALL` | `BIPED_SMALL` | `JPEG_IN_PNG` | `CARD_FALLBACK_RETAINED` | `CARD` | Complex multi-depth painted scene; retained on safe adaptive CARD presentation for Tier 2/3 batch. |
| 75 | 9149 | `SEED_010_EXPANSION` | `worg` | Worg | 2 | `MEDIUM` | `QUADRUPED_LOW` | `JPEG_IN_PNG` | `CARD_FALLBACK_RETAINED` | `CARD` | Complex multi-depth painted scene; retained on safe adaptive CARD presentation for Tier 2/3 batch. |
| 76 | 9150 | `SEED_010_EXPANSION` | `hippogriff` | Hippogriff | 2 | `LARGE` | `WINGED_LARGE_PREDATOR` | `JPEG_IN_PNG` | `CARD_FALLBACK_RETAINED` | `CARD` | Complex multi-depth painted scene; retained on safe adaptive CARD presentation for Tier 2/3 batch. |
| 77 | 9151 | `SEED_010_EXPANSION` | `giant_toad` | Giant Toad | 2 | `LARGE` | `QUADRUPED_MASSIVE` | `JPEG_IN_PNG` | `CARD_FALLBACK_RETAINED` | `CARD` | Complex multi-depth painted scene; retained on safe adaptive CARD presentation for Tier 2/3 batch. |
| 78 | 9152 | `SEED_010_EXPANSION` | `carbuncle` | Carbuncle | 2 | `TINY` | `REPTILIAN_TINY_LOW` | `JPEG_IN_PNG` | `CARD_FALLBACK_RETAINED` | `CARD` | Complex multi-depth painted scene; retained on safe adaptive CARD presentation for Tier 2/3 batch. |
| 79 | 9153 | `SEED_010_EXPANSION` | `phantom_fungus` | Phantom Fungus | 2 | `MEDIUM` | `PLANT_MASS_MEDIUM` | `JPEG_IN_PNG` | `CARD_FALLBACK_RETAINED` | `CARD` | Complex multi-depth painted scene; retained on safe adaptive CARD presentation for Tier 2/3 batch. |
| 80 | 9154 | `SEED_010_EXPANSION` | `gnoll_packmaster` | Gnoll Packmaster | 2 | `MEDIUM` | `BIPED_HEAVY_MEDIUM` | `JPEG_IN_PNG` | `CARD_FALLBACK_RETAINED` | `CARD` | Complex multi-depth painted scene; retained on safe adaptive CARD presentation for Tier 2/3 batch. |
| 81 | 9155 | `SEED_010_EXPANSION` | `giant_mantis` | Giant Mantis | 3 | `LARGE` | `ARACHNID_CHITIN_LARGE` | `JPEG_IN_PNG` | `CARD_FALLBACK_RETAINED` | `CARD` | Complex multi-depth painted scene; retained on safe adaptive CARD presentation for Tier 2/3 batch. |
| 82 | 9156 | `SEED_010_EXPANSION` | `spriggan` | Spriggan | 3 | `SMALL` | `BIPED_SMALL_DUAL_SIZE` | `JPEG_IN_PNG` | `CARD_FALLBACK_RETAINED` | `CARD` | Complex multi-depth painted scene; retained on safe adaptive CARD presentation for Tier 2/3 batch. |
| 83 | 9157 | `SEED_010_EXPANSION` | `will_o_wisp` | Will-o'-Wisp | 3 | `SMALL` | `FLOATING_ORB` | `JPEG_IN_PNG` | `NEWLY_PRODUCED_VERIFIED` | `INTEGRATED` | Verified RGBA cutout (603x606, transparent=28.2%, borderClean=100.0%) |
| 84 | 9158 | `SEED_010_EXPANSION` | `cheetah` | Cheetah | 3 | `MEDIUM` | `QUADRUPED_LOW` | `JPEG_IN_PNG` | `CARD_FALLBACK_RETAINED` | `CARD` | Complex multi-depth painted scene; retained on safe adaptive CARD presentation for Tier 2/3 batch. |
| 85 | 9159 | `SEED_010_EXPANSION` | `draugr` | Draugr | 3 | `MEDIUM` | `BIPED_HEAVY_MEDIUM` | `JPEG_IN_PNG` | `CARD_FALLBACK_RETAINED` | `CARD` | Complex multi-depth painted scene; retained on safe adaptive CARD presentation for Tier 2/3 batch. |
| 86 | 9160 | `SEED_010_EXPANSION` | `hobgoblin_captain` | Hobgoblin Captain | 3 | `MEDIUM` | `BIPED_HEAVY_MEDIUM` | `JPEG_IN_PNG` | `CARD_FALLBACK_RETAINED` | `CARD` | Complex multi-depth painted scene; retained on safe adaptive CARD presentation for Tier 2/3 batch. |
| 87 | 9161 | `SEED_010_EXPANSION` | `displacer_beast` | Displacer Beast | 4 | `LARGE` | `QUADRUPED_MASSIVE` | `JPEG_IN_PNG` | `CARD_FALLBACK_RETAINED` | `CARD` | Complex multi-depth painted scene; retained on safe adaptive CARD presentation for Tier 2/3 batch. |
| 88 | 9162 | `SEED_010_EXPANSION` | `shambling_mound` | Shambling Mound | 4 | `LARGE` | `PLANT_MASS_LARGE` | `JPEG_IN_PNG` | `CARD_FALLBACK_RETAINED` | `CARD` | Complex multi-depth painted scene; retained on safe adaptive CARD presentation for Tier 2/3 batch. |
| 89 | 9163 | `SEED_010_EXPANSION` | `leucrotta` | Leucrotta | 4 | `LARGE` | `QUADRUPED_MASSIVE` | `JPEG_IN_PNG` | `CARD_FALLBACK_RETAINED` | `CARD` | Complex multi-depth painted scene; retained on safe adaptive CARD presentation for Tier 2/3 batch. |
| 90 | 9164 | `SEED_010_EXPANSION` | `dire_boar` | Dire Boar | 4 | `LARGE` | `QUADRUPED_MASSIVE` | `JPEG_IN_PNG` | `CARD_FALLBACK_RETAINED` | `CARD` | Complex multi-depth painted scene; retained on safe adaptive CARD presentation for Tier 2/3 batch. |
| 91 | 9165 | `SEED_010_EXPANSION` | `forest_drake` | Forest Drake | 4 | `LARGE` | `WINGED_LARGE_PREDATOR` | `JPEG_IN_PNG` | `CARD_FALLBACK_RETAINED` | `CARD` | Complex multi-depth painted scene; retained on safe adaptive CARD presentation for Tier 2/3 batch. |
| 92 | 9166 | `SEED_010_EXPANSION` | `otyugh` | Otyugh | 4 | `LARGE` | `PLANT_MASS_LARGE` | `JPEG_IN_PNG` | `CARD_FALLBACK_RETAINED` | `CARD` | Complex multi-depth painted scene; retained on safe adaptive CARD presentation for Tier 2/3 batch. |
| 93 | 9167 | `SEED_010_EXPANSION` | `wyvern` | Wyvern | 5 | `LARGE` | `WINGED_LARGE_PREDATOR` | `JPEG_IN_PNG` | `NEWLY_PRODUCED_VERIFIED` | `INTEGRATED` | Verified RGBA cutout (944x953, transparent=53.4%, borderClean=100.0%) |
| 94 | 9168 | `SEED_010_EXPANSION` | `girallon` | Girallon | 5 | `LARGE` | `BIPED_TALL_BRUTE` | `JPEG_IN_PNG` | `CARD_FALLBACK_RETAINED` | `CARD` | Complex multi-depth painted scene; retained on safe adaptive CARD presentation for Tier 2/3 batch. |
| 95 | 9169 | `SEED_010_EXPANSION` | `catoblepas` | Catoblepas | 5 | `LARGE` | `QUADRUPED_MASSIVE` | `JPEG_IN_PNG` | `CARD_FALLBACK_RETAINED` | `CARD` | Complex multi-depth painted scene; retained on safe adaptive CARD presentation for Tier 2/3 batch. |
| 96 | 9170 | `SEED_010_EXPANSION` | `barrow_wight` | Barrow Wight | 5 | `MEDIUM` | `BIPED_HEAVY_MEDIUM` | `JPEG_IN_PNG` | `CARD_FALLBACK_RETAINED` | `CARD` | Complex multi-depth painted scene; retained on safe adaptive CARD presentation for Tier 2/3 batch. |
| 97 | 9171 | `SEED_010_EXPANSION` | `green_hag` | Green Hag | 5 | `MEDIUM` | `BIPED_MEDIUM` | `JPEG_IN_PNG` | `CARD_FALLBACK_RETAINED` | `CARD` | Complex multi-depth painted scene; retained on safe adaptive CARD presentation for Tier 2/3 batch. |
| 98 | 9172 | `SEED_010_EXPANSION` | `orc_warchief` | Orc Warchief | 5 | `MEDIUM` | `BIPED_HEAVY_MEDIUM` | `JPEG_IN_PNG` | `CARD_FALLBACK_RETAINED` | `CARD` | Complex multi-depth painted scene; retained on safe adaptive CARD presentation for Tier 2/3 batch. |

---

## 5. PF1e Size Reference Specimens (Non-Database Showcase Entries)

These 5 entries in `PF1E_SIZE_REFERENCE_SPECIMENS` are used exclusively by the Scale Arena to demonstrate Fine, Diminutive, Huge, Gargantuan, and Colossal scaling tiers and are **not** counted among the 98 database monsters:

| Ref ID | Slug | Name | PF1e Size | Reuses Source Art | Reuses Cutout Art |
|-------:|:-----|:-----|:----------|:------------------|:------------------|
| 99001 | `ref_fine_spore_mite` | Spore Mite (Fine PF1e Reference) | `FINE` | `/images/monsters/giant_spider.png` | `/lab-assets/images/monsters-cutout/giant_spider.png` |
| 99002 | `ref_diminutive_toad` | Cave Toad (Diminutive PF1e Reference) | `DIMINUTIVE` | `/images/monsters/giant_frog.png` | `None (CARD)` |
| 99007 | `ref_huge_elder_troll` | Ancient Treant / Giant Troll (Huge PF1e Reference) | `HUGE` | `/images/monsters/troll.png` | `/lab-assets/images/monsters-cutout/troll.png` |
| 99008 | `ref_gargantuan_wyrm` | Deep Crag Wyrm (Gargantuan PF1e Reference) | `GARGANTUAN` | `/images/monsters/wyvern.png` | `None (CARD)` |
| 99009 | `ref_colossal_titan` | World-Root Titan (Colossal PF1e Reference) | `COLOSSAL` | `/images/monsters/assassin_vine.png` | `/lab-assets/images/monsters-cutout/assassin_vine.png` |

---

## 6. Handoff Notes for Track 5 (Integration Lead)

1. **Inventory Manifest Ready:** `action-ui-lab/monster-artwork-inventory.json` contains exact `cutoutBounds` (`width, height, minX, minY, maxX, maxY, contentWidthRatio, contentHeightRatio, topPadRatio, bottomPadRatio, leftPadRatio, rightPadRatio`) and `validationMetrics` for all **37 verified cutouts** (`7 EXISTING_APPROVED` + `30 NEWLY_PRODUCED_VERIFIED`).
2. **Drop-in Compatibility with `monster-size-catalog.js` & `server.js`:** Every new cutout in `action-ui-lab/public/images/monsters-cutout/<slug>.png` follows the exact tight-crop + 12px transparent margin convention of the original 7 cutouts, so updating `hasCutout: true` and `cutoutContentBounds` in `MONSTER_SIZE_CATALOG` and registering the 30 new slugs in `INTEGRATED_MONSTER_PROFILES` in `action-ui-lab/server.js` will immediately enable full `INTEGRATED` first-person rendering with accurate ground-shadow anchoring.
