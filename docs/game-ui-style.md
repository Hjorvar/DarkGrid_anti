# Darkgrid — Game UI Master Style Guide

Þessi stílleiðbeining festir í sessi opinbert útlit, litasamsetningu, leturfræði og viðmótshönnun fyrir **Darkgrid**. Hún tryggir að vefviðmót leiksins falli fullkomlega að handmáluðum 2D myndstíl skrímslanna sem skilgreindur er í [`docs/monster-art-style.md`](monster-art-style.md) og dregur fram drungalega, dularfulla og ógnvekjandi stemningu leiksins.

Framvegis skal allt viðmót leiksins, nýjar síður, spjöld, hnappar og upplýsingagluggar fylgja þessum reglum án frávika.

---

## 🌒 1. Hugmyndafræði og heildarstemning (Design Philosophy)

- **Tegund (Genre):** *Dark Fantasy RPG Interface*.
- **Andrúmsloft:** Dökkt, þrúgandi, fornt og dulúðugt. Viðmótið á að líða eins og gömul leðurinnbundin bók eða steinrunnið handrit (grimoire) sem vaknar til lífs í daufri kyndlabirtu.
- **Skrímslamyndir í öndvegi:** Viðmótið er virðulegur rammi utan um leikheiminn — sérstaklega handmáluðu skrímslamyndirnar. Myndirnar eiga aldrei að líta út eins og „framandi aðskotahlutir“, heldur renna mjúklega saman við dökk viðmótsspjöldin með daufu jaðarfalli (*subtle edge blending* og *vignette*).
- **Læsilighed og birtuskil (Contrast & Readability):** Þótt leikurinn sé dökur er hreinleiki og skýrleiki texta í fyrirrúmi. Allur meginmálstexti uppfyllir ströngustu kröfur um birtuskil (WCAG AA og AAA) gegn dökkum bakgrunni.
- **Hófstillt glæsileiki (Subtle Elegance):** Engin æpandi neon- eða tölvuleikjaljós. Form og rammar byggja á veðruðum steini, dökkum járnmálmi og fornu bronsi/gulli.

---

## 🎨 2. Litakerfi og litapalletta (Color Palette)

Allir litir eru dregnir beint úr litapallettu samþykktu skrímslanna (*Assassin Vine*, *Grave Troll*, *Feral Wolf*):

### Grunnfletir (Backgrounds & Surfaces)
- **Abyss / Tómarúm (`--bg-void`):** `#07090c` — nánast svartur með örlitlum kolablæ.
- **Aðalbakgrunnur (`--bg-main`):** `#0c0f14` — djúpur kolagrátt með léttri móðuáferð.
- **Viðmótsspjöld (`--bg-surface`):** `#131720` — dökkur leðju- og tinnusteinblær.
- **Upphækkaðir fletir (`--bg-surface-elevated`):** `#1a202c` — örlítið ljósari flötur fyrir hólf, töflur og stýritakka.
- **Aftengdir / dældar fletir (`--bg-surface-sunken`):** `#090c10` — dældir, innsláttarreitir og bakgrunnur undir myndir.
- **Yfirlag / Modal (`--bg-overlay`):** `rgba(7, 9, 12, 0.85)` — dökkt móðugler.

### Rammalínur og kantar (Borders & Dividers)
- **Hlutlaus daufur rammi (`--border-subtle`):** `#222938` — veðraður steingrár kantur.
- **Virki rammi (`--border-medium`):** `#2d374a` — skýrari aðskilnaður á spjöldum.
- **Fornbrons / gulláhersla (`--border-gold`):** `rgba(197, 160, 89, 0.38)` — einkennislína fyrir mikilvæga kanta, yfirlitskassa og myndaramma.
- **Heilgull rammi (`--border-gold-solid`):** `#c5a059` — fullmálmaður brons/gull kantur fyrir valda hluti og aðalhnappa.

### Textalitir (Typography Colors)
- **Fyrirsagnir og nöfn (`--text-heading`):** `#f0e6d2` — fornt bókfell (parchment/bone). Hlýr, virðulegur tónn með hámarks birtuskilum.
- **Meginmálstexti (`--text-body`):** `#d6dae2` — fölgrátt með frábærri lesfimi á litlum og stórum skjám.
- **Aukaatriði og staðalupplýsingar (`--text-muted`):** `#8792a4` — aska og móða (WCAG AA samþykkt á `--bg-surface`).
- **Dimmt / Læst texti (`--text-dim`):** `#535e70` — óvirkir hnappar og ófærir valkostir.

### Einkennis- og stöðulitir (Semantic Accents)
- **Fornbrons & Gull (`--accent-gold`):** `#c5a059` (ljómi: `#e6be6e`, dökkt: `#7c6238`) — táknar auðæfi, hetju-orðstír, valda kosti og aðalvalmyndir. Dregið af glóandi augum Feral Wolf.
- **Ógn & Blóð (`--accent-crimson`):** `#9e2a2b` (ljómi: `#c53030`, bakgrunnur: `rgba(158, 42, 43, 0.2)`) — táknar bardaga, skaða, lífsháska og hættuleg svæði.
- **Náttúra & Friður (`--accent-moss`):** `#3d6e46` (ljómi: `#5fa66d`, bakgrunnur: `rgba(61, 110, 70, 0.2)`) — táknar örugg svæði, veiðimannahæfileika og jurtir. Dregið af mosahúð Grave Troll og laufum Assassin Vine.
- **Eitur & Seiður (`--accent-toxic`):** `#5c3870` (ljómi: `#8954a6`, bakgrunnur: `rgba(92, 56, 112, 0.2)`) — dularfullir galdrar, eiturblóm Assassin Vine og forboðin rún.
- **Lífsþol (HP) stöður:**
  - Heilbrigt (>50%): `#4ade80` (smaragðgrænt).
  - Sært (25–50%): `#f59e0b` (gulbrúnt).
  - Hættustig (<25%): `#ef4444` (blóðrautt).

---

## 🔤 3. Leturfræði (Typography)

1. **Titlar og heiti (Display & Headings):**
   - Leturfjölskylda: `'Cinzel', 'Trajan Pro', Georgia, serif`.
   - Stíll: Hástafir eða virðuleg hástafabyrjun, `letter-spacing: 0.05em - 0.12em`.
   - Textaskuggi: `text-shadow: 0 2px 4px rgba(0, 0, 0, 0.8)` fyrir dýpt og lesanleika gegn dökkum flötum.
2. **Meginmál og lýsingar (Body & Lore):**
   - Leturfjölskylda: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`.
   - Línubil: `1.6 - 1.7` til að tryggja áreynslulausan lestur á löngum textum.
   - Sögulýsingar (Narrative): Skáletrað með fornbókfelli (`#d6dae2`), skreytt með vinstri kanti í `--border-gold`.
3. **Tölfræði, d20 og hnit (Stats & Numerals):**
   - Leturfjölskylda: `'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace`.
   - Skýr greinarmunur á tölustöfum, gildum og bónusum (+2, -1, 1d8+7, [X: 7, Y: 7]).

---

## 🖼️ 4. Framsetning skrímslamynda (Monster Artwork Integration)

Þegar hetjan mætir óvætt eða skrímsli á myndin að vera sjónræn þungamiðja atburðarins:

- **Myndarammi (`.monster-art-frame`):**
  - Ferningur með **1:1** hlutföllum (`aspect-ratio: 1 / 1`).
  - Hámarksbreidd: **280px × 280px** í tölvuviðmóti (side-by-side við texta) eða allt að **320px** þegar rúm leyfir.
  - Rammi: `1px solid var(--border-gold)` með fínlegum hornum (`border-radius: 6px`).
  - Skuggi og dýpt: `box-shadow: 0 10px 30px rgba(0, 0, 0, 0.8), inset 0 0 15px rgba(0, 0, 0, 0.7)`.
  - Jaðarfall: Myndin er með lágstemmt innra móðufall sem bindur hana saman við svarta viðmótsflötinn.
- **Samhliða uppsetning (Side-by-Side Layout):**
  - Á tölvuskjám (>768px) er skrímslamyndin vinstra megin og textalýsing, veiðimannaskynjun og valhnappar hægra megin.
  - Á farsímum raðast myndin efst og textinn fyrir neðan.
- **Staðgengill (Placeholder System):**
  - Ef skrímsli hefur enga tiltæka myndaskrá birtist sjálfkrafa rúnastaðgengill með sama 1:1 hlutfalli.
  - Bakgrunnur: Dökk dæld (`#090c10`) með daufum fornum rúnahring, skrímslatákninu (`symbol`) í réttum lit og textanum *„Ókönnuð ógn — Mynd í vinnslu“*.

---

## 🧭 5. Hnappar og stýringar (Buttons & Actions)

- **Aðalhnappar (Primary - Skoða nánar / Rannsaka / Innskrá):**
  - Grunnur: Fornbrons / gullhalli (`background: linear-gradient(180deg, #7c6238 0%, #544122 100%)`).
  - Texti: `#fdfaf3` með skörpum lágstemmdum skugga.
  - Kantur: `1px solid #c5a059`.
  - Hover: Ljómi með léttri gullbirtu (`box-shadow: 0 0 16px rgba(197, 160, 89, 0.45)`, `transform: translateY(-1px)`).
- **Aukahnappar (Secondary - Sniðganga / Hörfa / Hætta við):**
  - Grunnur: Dökkur steingrár flötur (`#181e28`).
  - Kantur: `1px solid #2d374a`.
  - Texti: `#d6dae2`.
  - Hover: Bakgrunnur lýsist í `#222b3a`, kantur í `#3d4b65`.
- **Hreyfistýringar (Compass Rose):**
  - 4-átta kross (Norður, Suður, Austur, Vestur) byggður eins og forn áttaviti.
  - Virkir takkar: Djúp járnáferð (`#1a202c`) með gullbryddingum á bendli (`hover: border-color: #c5a059`).
  - Miðjumerki: Rúnagullt tákn `✦` eða `🧭` sem sýnir miðju heimsins.
  - Ófærir reitir eða læstir vegna ógnar: Dofna í `opacity: 0.35` með krossuðum bendli (`cursor: not-allowed`).

---

## 🗺️ 6. Yfirlitskort og leikgögn (Minimap & Character Sheet)

- **Minimap (5×5):**
  - Bakgrunnur: Djúpt hyldýpi (`#07090c`) með tvöföldum steingráum og fornbrons kanti.
  - Reitir: Hver reitur er skýr með sínum einkennislit og tákni (borg, skógur, mýri, frumskógur, slétta).
  - Hetjureiturinn (`@`): Sérstök gull- og blóðlýsing með lifandi púlsandi ljóma (`filter: drop-shadow(0 0 6px rgba(197, 160, 89, 0.9))`).
- **Hetjuspjald (Character Sheet):**
  - Vitals:
    - **Lífsþol (HP):** Skýr stöðustika (health gauge) ásamt tölum í monospace (`núverandi / hámark`).
    - **Gull:** Málmgull tölustafir með fornbrons tákni.
  - Hæfileikatölur (Ability Scores):
    - Snyrtileg tafla með STR, CON, DEX, INT, WIS, CHA.
    - d20 bónusar eru greinilega afmarkaðir með mismunandi lit eftir jákvæðum/neikvæðum gildum.
  - Flipastýring (Tabs):
    - Virkur flipi merktur með fornbrons undirstrikun og hástöfum.

---

## 📜 7. Eyðublöð og innskráning (Forms & Grimoires)

- **Spjaldahönnun (Card Enclosures):**
  - Miðjusett, leður/grimoire áferð með fínlegum hornaskreytingum og daufum ytri skugga (`box-shadow: 0 16px 40px rgba(0, 0, 0, 0.7)`).
- **Innsláttarreitir (`input`, `select`):**
  - Dældar fletir (`#090c10`) með veðruðum kanti (`#222938`).
  - Við virkjun (focus): Mjúk gullglæða (`box-shadow: 0 0 0 2px rgba(197, 160, 89, 0.35)`).
- **Hetjustofnun (Character Creator):**
  - Stéttaspjöld (Class Cards): Sýna einkenni og tölfræði. Valið spjald fær fornbrons ramma og gullbirtu.
  - Stigatölur (Stat Steppers): Nákvæmir hækka/lækka takkar með skýrri stöðu á eftirstöðvum punkta.

---

## 📱 8. Aðlögun að skjástærðum (Responsive Breakpoints)

- **Tölvur og breiðskjáir (>900px):**
  - 2ja dálka leikjagluggi: Frásögn og atburðir vinstra megin (sveigjanleg breidd), kort og hetjuspjald hægra megin (340px fast).
- **Spjaldtölvur og millistærðir (600px - 900px):**
  - Ein dálks flæði: Frásögn, skrímslamynd, hreyfistýringar, þar á eftir kort og hetjuspjald.
- **Farsímar (<600px):**
  - Fullbreiddar spjöld með 12px rammabili.
  - Skrímslamynd miðjusett og fyllir rammann.
  - Snertivænir hnappar (lágmarkshæð 44px fyrir alla hreyfitakka).

---

## 🚫 9. Hvað skal forðast (Strictly Prohibited)

1. **Skærir neon-litir eða óreyndir flatir litir:** Enginn hreinn skærrauður `#ff0000`, skærblár `#0000ff` eða venjulegt flatt Tailwind/Bootstrap útlit.
2. **Hvítir eða ljósir bakgrunnar:** Leikurinn á alltaf að vera dökur og dulúðugur.
3. **Ofhlaðin teiknimyndaáhrif:** Engar leikjaspilalínur, hreyfðar teiknimyndir eða glansandi plastáferð.
4. **Ólæsilegur texti:** Daufur texti má aldrei falla niður fyrir 4.5:1 birtuskilastig gegn bakgrunni.
5. **Afskurður á myndum:** Skrímslamyndir skulu alltaf birtast í fullri 1:1 stærð án þess að afskera höfuð eða útlimi.
