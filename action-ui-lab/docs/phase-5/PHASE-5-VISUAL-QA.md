# DARKGRID ADVENTURE LAB — PHASE 5 LIVE BROWSER VISUAL QA (`PHASE-5-VISUAL-QA.md`)

**Dagsetning:** 2026-10-21  
**Mæligögn:** [`docs/phase-5/visual-qa-metrics.json`](visual-qa-metrics.json)  
**Skjámyndamappa:** [`docs/phase-5/screenshots/`](screenshots/) (`56` skjámyndir)

---

## 1. Yfirlit yfir lifandi Chromium prófanir

Lifandi Chromium vafri var ræstur í gegnum CDP á móti einangruðum Phase 5 Action UI Lab þjóni og tók `56` skjámyndir yfir:
1. **Contact Sheet allra 13 nýju myndanna (`00_candidate_art_contact_sheet.png` / `art-candidates/contact_sheet_candidates.png`).**
2. **40 sjónarhorn á samþykktum kennileitum og hindrunum (`01_*.png` til `40_*.png`):**
   - Oakhaven (`[7,7]` N/E/S/W), North Gate (`[7,6]` N/E/S/W), Mirkwood Crossroads (`[7,5]` N/E/S/W), Mirkwood Trail (`[7,4]` N/S), Primeval Black Oak (`[7,3]` N/S), Old Stone Bridge (`[8,7]` E/W/N/S), Bridge East Watchpost (`[9,7]` W/E/N/S), South Gate (`[7,8]` N/S/E/W), Rotting Fen Boardwalk (`[6,10]` S), Deadman's Mire (`[4,11]` N/S/E/W), Raven Crags (`[3,5]` N/S), Windblown Heath (`[12,4]` N), Venomous Jungle (`[9,11]` S), Darkmount Barrier (`[7,1]` N), Murksea Barrier (`[13,7]` E) og Bottomless Mire Barrier (`[4,12]` S).
3. **11 sjónarhorn í Candidate Art Preview Mode (`41_*.png` til `51_*.png`):**
   - Sýnir nýju myndirnar í raunverulegu leikjaviðmóti (`[9,7] SOUTH`, allar 5 nýju transition-senurnar og öll 5 stækkuðu Tier 4 vistkerfissöfnin).
4. **4 skjáupplausnir á Mirkwood Crossroads (`52_resolution_*.png`):**
   - `1920×1080`, `1366×768`, `1280×800` og `390×844` (mobile).

---

## 2. Mælingar á skjáupplausnum og villulausri keyrslu

| Upplausn | Gluggastærð | Stærð Aðalsenu (`#action-viewport`) | Hlutfall Aðalsenu af Skjá | Lárétt Yfirflæði (`hasHorizontalOverflow`) | Console Villur | Page Villur |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Desktop Full HD (`1920×1080`)** | `1920 × 1080` | `1526 × 953 px` | **`70.1%`** ($\ge 65\%$ markmið) | `false` (`0 px`) | `0` | `0` |
| **Laptop HD (`1366×768`)** | `1366 × 768` | `1069 × 655 px` | **`66.7%`** ($\ge 65\%$ markmið) | `false` (`0 px`) | `0` | `0` |
| **Compact / Steam Deck (`1280×800`)** | `1280 × 800` | `1000 × 687 px` | **`67.1%`** ($\ge 65\%$ markmið) | `false` (`0 px`) | `0` | `0` |
| **Mobile Portrait (`390×844`)** | `390 × 844` | `376 × 351 px` | **`40.1%`** (staflað layout) | `false` (`0 px`) | `0` | `0` |

### Helstu niðurstöður sjónrænnar skoðunar
- **Engin svört eða tóm svæði:** Allar bakgrunnsmyndir fylla `100%` af `#fp-scene-backdrop` með mjúku A/B crossfade.
- **Engin skörun við UI:** Áttaviti, POI hnappur (`[I]`), leiðangursvísir og neðri stöðulína liggja hreint yfir jöðrum myndflatarins án þess að hylja sjóndeildarhring eða göngustíg.
- **Samhengisháð POI virkni:** Á `[9,7] SOUTH` í Candidate Preview Mode (`41_candidate_preview_watchpost_9_7_south_gorge.png`) birtist `INSPECT BREACHED SOUTHERN WALL [I]` sem lýsir nákvæmlega ryðgaða varðspjótinu og rofna steinveggnum á myndinni.
