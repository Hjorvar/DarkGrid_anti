---
name: game-ui-rules
description: Official rules and constraints for game UI design, styling, and visual cohesion in Darkgrid.
---

# Darkgrid — Game UI Rules

Þetta skjal inniheldur opinberar reglur fyrir alla gervigreindarforritara (AI coding agents) varðandi hönnun, stílsnið og viðmótssamræmingu í **Darkgrid**.

> [!IMPORTANT]
> **Samræmt Dark Fantasy viðmót er í gildi.**
> Allt viðmót leiksins skal endurspegla drungalegan og dulúðugan heim Darkgrid og taka mið af samþykktu skrímslamyndunum í [`images/monsters/`](../../images/monsters/) og stílleiðbeiningunum í [`docs/game-ui-style.md`](../../docs/game-ui-style.md) og [`docs/monster-art-style.md`](../../docs/monster-art-style.md).

---

## 1. Meginreglur um viðmótshönnun (Core UI Principles)

1. **Samræmdur sjónrænn tónn:**
   - Viðmótið á að minna á forn handrit (grimoire), steinrunna rústaveggi og fornt brons/gull.
   - Bannað er að nota flatt, nútímalegt tækniviðmót (t.d. hefðbundið Bootstrap eða flatt SaaS-útlit).
2. **Litapalletta dregin af skrímslamyndum:**
   - Nota skal staðlaðar CSS-breytur úr `:root`.
   - Bannað er að nota skæra eða neonglæsta liti (t.d. `#ff0000`, `#00ff00`).
   - Aðallitur fyrir vörumerki, valkosti og hápunkta er fornbrons/gull (`--accent-gold: #c5a059`).
   - Blóð og bardagi nota deyfðan vínrauðan tón (`--accent-crimson: #9e2a2b`).
   - Náttúra og örugg svæði nota skógarmosa (`--accent-moss: #3d6e46`).
3. **Læsileiki og birtuskil (Accessibility & Contrast):**
   - Allur texti verður að uppfylla lágmarkskröfur WCAG AA (4.5:1 birtuskil gegn bakgrunni).
   - Fyrirsagnir nota fornt bókfell (`--text-heading: #f0e6d2`), meginmál notar fölgrátt (`--text-body: #d6dae2`).

---

## 2. Framsetning skrímslamynda (Monster Artwork in UI)

Þegar skrímsli birtist í viðmóti (t.d. við atburði eða bardaga):

1. **Rammi og hlutföll:**
   - Myndin skal alltaf birtast í **1:1** ferningshlutfalli (`aspect-ratio: 1 / 1`).
   - Notast skal við staðlaðan ramma (`.monster-art-frame`) með lágstemmdum fornbrons kanti (`--border-gold`) og daufu jaðarfalli.
2. **Staðgengill (Fallback System):**
   - Ef skrímsli hefur enga samþykkta myndaskrá skal viðmótið sýna staðlaðan rúnastaðgengil með sama 1:1 hlutfalli, dökkum bakgrunni og skrímslatákninu (`symbol`).
   - Aldrei sýna brotna myndatengla (`broken image icon`).
3. **Enginn afskurður:**
   - Myndir skulu aldrei afskorast með `object-fit: cover` á þann hátt að höfuð eða útlimir tapist. Notið `object-fit: contain` eða rétt miðjusett hlutföll.

---

## 3. Íhlutir og hönnunarmynstur (Component Patterns)

1. **Hnappar (Buttons):**
   - **Aðalhnappar (`.btn-primary`):** Fornbrons/gull gradient (`#7c6238` -> `#544122`) með gullkanti og heitum ljóma við hover.
   - **Aukahnappar (`.btn-secondary`):** Dökkur steingrár flötur (`#181e28`) með daufum kanti.
   - Allir hnappar skulu hafa skýran bendil (`cursor: pointer`) og smekklega lýsingu við bendilsnertingu.
2. **Áttaviti og hreyfistýringar (Compass Rose):**
   - 4-átta hnappar (Norður, Suður, Austur, Vestur) með skýrum áttarörvum og örnefnum í vísbendingum (`title`).
   - Læstir eða ófærir takkar skulu vera greinilega deyfðir (`opacity: 0.35`, `cursor: not-allowed`).
3. **Yfirlitskort (5×5 Minimap):**
   - Staðsett á hyldýpisbakgrunni (`#07090c`) með tvöföldum kanti.
   - Hetjan (`@`) skal skera sig úr með skærum ljóma og gull- eða blóðrauðum bjarma.
4. **Hetjuspjald og lífsþol (Character Sheet & Vitals):**
   - Lífsþol (HP) skal sýnt bæði með tölustöfum og sjónrænni stöðustiku (health gauge bar).
   - Tölfræði (STR, CON, DEX, INT, WIS, CHA) skal birt í skýrri töflu með d20 bónusum greinilega afmörkuðum í monospace letri.

---

## 4. Tæknilegar kvaðir (Technical & Architectural Rules)

1. **Engar breytingar á leikjareglum eða gagnagrunni:**
   - Viðmótsbreytingar mega **aldrei** breyta SQLite töfluskilgreiningum, d20 vélfræði, gögnum eða atburðalógík.
2. **Server-Side Rendering (EJS):**
   - Halda skal öllu viðmóti í EJS sniðmátum (`src/views/`) og aðskildu CSS í `public/css/style.css`.
3. **Statískar skrár:**
   - Myndir skulu aðgengilegar í gegnum `/images/` slóðina í Express (`app.use('/images', express.static(...))`).
4. **Sjálfvirk próf:**
   - Allar viðmótsuppfærslur verða að standast prófunarferlið (`npm test`) án þess að brjóta samþættingarpróf eða leiðarpróf.

---

## 5. Skjástærðir og snjalltæki (Responsiveness)

- Viðmótið verður að virka gallalaust á öllum skjástærðum frá 360px snjallsímum upp í 4K breiðskjái.
- Á litlum skjám skal leikjaglugginn raðast í einn dálk með snertivænum tökkum (lágmarkshæð 44px).
