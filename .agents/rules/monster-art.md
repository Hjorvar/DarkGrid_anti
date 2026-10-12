---
name: monster-art-rules
description: Official rules and constraints for generating and managing monster artwork in Darkgrid.
---

# Darkgrid — Monster Art Rules

Þetta skjal inniheldur opinberar reglur fyrir alla gervigreindarforritara (AI coding agents) varðandi myndskreytingar og vinnslu á skrímslamyndum í **Darkgrid**.

> [!IMPORTANT]
> **Samþykktur myndstíll er nú í gildi.**
> Allar skrímslamyndir skulu framvegis fylgja opinberu stílleiðbeiningunni í [`docs/monster-art-style.md`](../../docs/monster-art-style.md) og taka mið af samþykktu tilvísunarmyndunum í [`images/monsters/_references/`](../../images/monsters/_references/).

---

## 1. Myndagerð og tól (Image Generation Engine)

- Nota skal **Google Nano Banana / Gemini Image** myndagerðartólið (`generate_image`).
- Bannað er að nota handahófskenndar myndir af netinu eða óskyld myndagerðartól nema með sérstöku leyfi.
- Aldrei halda því fram að mynd hafi verið búin til nema skráin sé raunverulega til staðar á disknum.
- Ef myndagerðarþjónustan er óaðgengileg skal útskýra takmörkunina í stað þess að grípa til óviðkomandi lausna.

---

## 2. Samræmdur myndstíll (Approved Visual Style)

Öll skrímsli skulu líta út eins og þau tilheyri sama leik og séu myndskreytt af sama listamanni.

- **Fastur stíll:** Handmálað 2D stafrænt málverk (*Hand-painted 2D digital art bestiary illustration*).
- **Stemning:** Dökkt, drungalegt, hættulegt og dulúðugt (*Dark fantasy RPG, atmospheric, ominous*).
- **Litatónar:** Deyfðir jarð- og náttúrulitir (kolagrátt, mosi, dökkt leðjubrúnt, aska) með vandlega völdum hápunktum (glóandi gulbrún augu, dimmfjólublá eiturblóm, beittar tennur).
- **Lýsing:** Lágstemmd lýsing (*low-key*) með mjúkri jaðarlýsingu (*atmospheric rim lighting*) sem aðgreinir veruna frá dimmum bakgrunni.
- **Uppsetning:** Veran er miðjusett, öll sýnileg frá toppi til táar/rótar, með 10–15% öryggisbili að ramma.
- **Bakgrunnur:** Dökkur, lágstemmdur móðubakgrunnur úr náttúrulegu búsvæði með dökku jaðarfalli (*vignette*).
- **Bannað:**
  - Ljósmyndaraunsæi og 3D/CGI gljástíll.
  - Teiknimynda- eða anime-stíll.
  - Skærir, glaðlegir eða of mettaðir litir.
  - Texti, rammateikningar, spilaspjöld, vatnsmerki eða lógó.
  - Afskurður á útlimum eða höfði.

Nákvæmar reglur, litatöflur og prompt-sniðmát eru í [`docs/monster-art-style.md`](../../docs/monster-art-style.md).

---

## 3. Tilvísunarkerfi (Style Reference System)

Áður en nýtt skrímsli er teiknað skal agentinn:
1. Lesa aðalstílleiðbeininguna í [`docs/monster-art-style.md`](../../docs/monster-art-style.md).
2. Skoða samþykktu tilvísunarmyndirnar í [`images/monsters/_references/`](../../images/monsters/_references/):
   - `assassin_vine.png` (fyrir plöntur og gróður)
   - `grave_troll.png` (fyrir mannlaga og risavaxnar óvættir)
   - `feral_wolf.png` (fyrir dýr og ferfætlinga)
3. Endurnota staðlaða prompt-sniðmátið úr stílleiðbeiningunni.
4. Breyta eingöngu lýsingu og einkennum skrímslisins — **aldrei breyta sjálfum myndstílnum**.

---

## 4. Útlitsrannsókn og Pathfinder-heimildir (Monster Anatomy & Lore Research)

Agentinn verður að rannsaka útlit hvers skrímslis áður en mynd er gerð. Bannað er að búa til mynd eingöngu út frá eigin getgátum eða nafni skrímslisins.

### Vinnuferli áður en ný skrímslamynd er búin til:
1. **Skoðaðu upplýsingar um skrímslið í SQLite:** Kannaðu gögnin í töflunni `monsters` (heiti, búsvæði, textalýsingar, hreyfimáta og sérhæfileika).
2. **Leitaðu að samsvarandi skrímsli á Archives of Nethys:** Helst Pathfinder 1e á [https://aonprd.com/](https://aonprd.com/).
3. **Finndu grunnlýsingu þess:** Sérstaklega líkamsbyggingu, stærð, liti, húð/áferð (t.d. feld, börk, hreistur, slím), útlimi, höfuð/kjaft, augu og önnur einkennandi útlitsatriði.
4. **Staðfestu að heimildin fjalli um rétta skrímslið:** Ganga úr skugga um að lýsingin og eðli verunnar á Archives of Nethys eigi við rétta skrímslið í Darkgrid.
5. **Skrifaðu sjálfstæða sjónræna lýsingu byggða á staðfestum upplýsingum:** Búðu til lýsandi texta á ensku fyrir promptið sem dregur saman líffærafræði og sjónræn einkenni.
6. **Notaðu lýsinguna ásamt samþykktum Darkgrid-myndstíl við myndagerð með Nano Banana:** Settu lýsinguna inn í staðlaða prompt-sniðmátið (úr `docs/monster-art-style.md`) og kallaðu á myndagerðartólið (`generate_image`).
7. **Notaðu samþykktar viðmiðunarmyndir til að viðhalda sama stíl:** Vísaðu í og berðu saman við samþykktu myndirnar í `images/monsters/_references/` til að tryggja samræmdan stíl og litatóna.

### Heimildir og höfundarréttur:
- **Skráning á heimild og lýsingu:** Skráðu slóð á heimildina (URL á Archives of Nethys) og eigin útlitslýsingu fyrir hvert skrímsli.
- **Bann við afritun:** Ekki afrita Pathfinder-myndir, langa frumtexta eða leyfisvarið sértækt efni án viðeigandi heimildar. Allar lýsingar skulu vera sjálfstæðar útdráttar- og sjónlýsingar.
- **Frávik ef skrímsli finnst ekki:** Ef skrímsli finnst ekki á Pathfinder skaltu nota núverandi Darkgrid-lýsingar úr gagnagrunninum og merkja sérstaklega að Pathfinder-heimild hafi ekki fundist.

---

## 5. Gögn úr gagnagrunni (Monster Data Grounding)

Sækja skal allar upplýsingar um skrímsli úr SQLite töflunni `monsters`:
- Heiti (`name`)
- Búsvæði (`habitat`)
- Textalýsingar (`descriptions`)
- Hreyfimáti og sérhæfileikar (`movement_type`, `special_abilities`)

Bannað er að búa til líkamleg einkenni sem stangast á við lýsingar í gagnagrunninum.

---

## 6. Tæknilegar kröfur (File Specifications)

- **Snið:** PNG.
- **Strigi:** Ferningur 1:1, upplausn **1024 × 1024 px**.
- **Skráarheiti:** `images/monsters/<monster_name>.png` (lágstafir með undirstrikum, án viðskeyta eins og `[DEV-PLACEHOLDER]`).
- **Skölun:** Smækkaðar útgáfur (t.d. fyrir viðmót eða minimap) skulu búnar til með hefðbundinni myndskölun (resizing) af samþykktu myndinni, **aldrei** með nýrri gervigreindarmyndagerð.

---

## 7. Gagnagrunnstenging (Database Integration)

- Slóð á mynd skal vistuð í SQLite gagnagrunninum (`images/monsters/<name>.png`).
- Bannað er að vista binera myndagögn í SQLite.
- Ekki má breyta tölfræði skrímsla, jafnvægi eða leikreglum samhliða myndagerð.
- Bannað er að skrifa yfir samþykktar myndir án undangengins leyfis.

---

## 8. Gæðaeftirlit og samþykki (Approval & Quality Control)

- **Fyrsta stílprófun:** Fullkláruð og samþykkt (Assassin Vine, Grave Troll, Feral Wolf).
- **Áframhaldandi vinna:** Vinna skal í smáum lotum (small batches).
- Búðu aðeins til **eina** aðalmynd fyrir hvert skrímsli.
- Ekki búa til afbrigði, stellingar eða hreyfimyndir nema sérstaklega sé beðið um það.
