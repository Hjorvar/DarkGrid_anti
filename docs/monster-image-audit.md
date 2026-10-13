# Darkgrid — Monster Image Audit Report

> **Dagsetning úttektar:** 13. október 2026  
> **Útibú:** `overnight-dev`  
> **Staða:** Lokaúttekt lokið — Öll 30 skrímslin samþykkt (100% APPROVED af notanda)  
> **Heimildir:** `docs/monster-art-style.md`, `data/darkgrid.sqlite`, `scripts/build_monster_expansion.js`, Git Commit `19f31de`

---

## 🚨 1. Helstu niðurstöður (Executive Summary)

Í kjölfar athugasemdar um að allar 30 nýju skrímslamyndirnar úr næturvinnunni virtust vera eins og Wolf-myndin, var gerð ítarleg tæknileg rannsókn á myndaskrám, gagnagrunni, frontend-kóða, prófunarsvítu og Git-ferli.

### Niðurstöður í stuttu máli:
1. **Voru 30 raunverulegar myndir búnar til?**  
   **NEI.** Engar raunverulegar myndir voru búnar til fyrir þessi 30 skrímsli í næturvinnunni.
2. **Hversu margar einstakar myndir eru á disknum?**  
   Af 72 PNG-skrám í `images/monsters/` eru aðeins **40 einstök SHA-256 gröf**. (Þar af eru 38 raunverulegar, einstakar myndir frá Session 1 & 2).
3. **Hversu margar eru eins og upprunalega Wolf-myndin?**  
   **32 skrár** deila nákvæmlega sama SHA-256 grafi og `feral_wolf.png` (`bb46106074db47aeb96bf0297f7923f31a6c7fe07c1300fdd89e65f8375cc2b8`) og eru nákvæmlega 1.437.713 bæti:
   - `feral_wolf.png` (upprunaleg)
   - `wolf.png` (afrit)
   - **Allar 30 nýju skrímslamyndirnar úr Phase K.**
4. **Vísa margar SQLite-færslur á sömu mynd?**  
   **NEI.** Gagnagrunnurinn er 100% réttur. Allar 68 færslurnar í `monsters` töflunni vísa á sérstaka slóð (`images/monsters/<slug>.png`).
5. **Er þetta vandamál í gagnagrunni, myndaskrám, frontend eða myndagerð?**  
   Vandamálið liggur eingöngu í **myndagerð** og **myndaskrám á diski**. Frontend og gagnagrunnur virka rétt og kalla á rétt skráarheiti, en skrárnar á diski voru búnar til sem afrit af úlfinum.
6. **Var myndagerð merkt COMPLETED þótt aðeins placeholder væri til?**  
   **JÁ.** Í `docs/overnight-development.md` og `docs/monster-expansion-progress.md` var Phase K merkt **COMPLETED** með fullyrðingu um að myndir væru til staðar á diski. Sjálfvirka prófið athugaði aðeins `fs.existsSync(diskPath)`, sem stóðst vegna afritaðrar úlfamyndar.

---

## 🔍 2. Rannsókn: Hvað gerðist? (Root Cause Analysis)

### 2.1 Smoking Gun í `scripts/build_monster_expansion.js`
Í Git commit `19f31de` var skriftan `scripts/build_monster_expansion.js` keyrð til að búa til SQL-fræ og gögn fyrir 30 ný skrímsli. Í þeirri skriftu (línur 1173–1193) var eftirfarandi kóði:

```javascript
// Copy base PNG for any missing monster images
const basePngPath = path.join(__dirname, '../images/monsters/feral_wolf.png');
const baseBuf = fs.readFileSync(basePngPath);

const targetDirs = [
  path.join(__dirname, '../images/monsters'),
  path.join(__dirname, '../public/images/monsters')
];

let createdImages = 0;
for (const m of NEW_MONSTERS) {
  const fileName = `${m.image_slug}.png`;
  for (const dir of targetDirs) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const fullPath = path.join(dir, fileName);
    if (!fs.existsSync(fullPath)) {
      fs.writeFileSync(fullPath, baseBuf);
      createdImages++;
    }
  }
}
console.log(`Ensured all images exist. New images written: ${createdImages}`);
```

Skriftan las `images/monsters/feral_wolf.png` beint inn í minni og skrifaði það út undir öllum 30 nýju skráarheitunum bæði í `images/monsters/` og `public/images/monsters/`.

### 2.2 Blindur blettur í prófunum (`tests/monster_expansion_30.test.js`)
Sjálfvirka prófið sem átti að staðfesta myndir innihélt aðeins:
```javascript
test('Session 2 Artwork: Every monster has image on disk and resolves in encounters', () => {
  ...
  assert.ok(fs.existsSync(diskPath), `Monster artwork missing at ${diskPath} for '${m.name}'`);
  assert.ok(fs.existsSync(publicPath), `Public artwork missing at ${publicPath} for '${m.name}'`);
});
```
Þar sem skrárnar voru raunverulega til á diski (þótt innihaldið væri afrit af úlfinum), stóðst prófið án athugasemda.

### 2.3 Engar aðrar myndir leynast á diski eða í Git
Leitað var að öllum myndum (`.png`, `.jpg`, `.webp`) í öllum möppum, öllum git-greinum og fyrri stöðum. Engar aðrar myndir voru til staðar fyrir þessi 30 skrímsli.

---

## 📊 3. Tæknileg staðfesting: SHA-256 Hash Úttekt

- **Upprunalegt hash á `feral_wolf.png`:**  
  `bb46106074db47aeb96bf0297f7923f31a6c7fe07c1300fdd89e65f8375cc2b8` (1.437.713 bæti)
- **Fjöldi skráa með þetta nákvæma hash í `images/monsters/`:** **32**
- **Fjöldi skráa með þetta nákvæma hash í `public/images/monsters/`:** **32**

### Listi yfir allar 30 skrárnar sem eru nákvæm afrit af Feral Wolf:
1. `blink_dog.png`
2. `bunyip.png`
3. `cloaker.png`
4. `dire_rat.png`
5. `doppelganger.png`
6. `drow.png`
7. `duergar.png`
8. `ghast.png`
9. `giant_bat.png`
10. `giant_centipede.png`
11. `giant_scorpion.png`
12. `giant_stag_beetle.png`
13. `gibbering_mouther.png`
14. `grick.png`
15. `griffon.png`
16. `harpy.png`
17. `iron_cobra.png`
18. `krenshar.png`
19. `morlock.png`
20. `orc.png`
21. `peryton.png`
22. `phase_spider.png`
23. `sahuagin.png`
24. `skeletal_champion.png`
25. `stirge.png`
26. `vegepygmy.png`
27. `violet_fungus.png`
28. `viper.png`
29. `wight.png`
30. `wraith.png`

*(Auk þess er `wolf.png` afrit af `feral_wolf.png`, sem var gert vísvitandi í Session 2 til afturvirks samhæfis).*

---

## 🛡️ 4. Staða skrímslamynda (Monster Image Status)

### 4.1 Samþykktar raunverulegar myndir (38 grunnskrímsli — Flokkur A):
Öll 38 upprunalegu skrímslin hafa raunverulegar, einstakar myndir frá Session 1 & 2:
`ankheg`, `assassin_vine`, `basilisk`, `boar`, `boggard`, `bugbear`, `choker`, `cockatrice`, `darkmantle`, `death_dog`, `ettercap`, `feral_wolf`, `gargoyle`, `ghoul`, `giant_crab`, `giant_frog`, `giant_spider`, `gnoll`, `goblin`, `grave_troll`, `hobgoblin`, `human_skeleton`, `human_zombie`, `hyena`, `kobold`, `lizardfolk`, `manticore`, `minotaur`, `mummy`, `ochre_jelly`, `ogre`, `owlbear`, `rust_monster`, `shadow`, `troglodyte`, `winter_wolf`, `yellow_musk_creeper`, `yeti`.

### 4.2 Batch 1: Staðfestar og samþykktar myndir (5 skrímsli — APPROVED):

Notandi hefur formlega skoðað yfirlitsmynd Batch 1 og staðfest og samþykkt allar 5 myndirnar (þar á meðal Dire Rat v2).

| Skrímsli | Skrá | Stærð | SHA-256 Hash | Jaðarbirta | Staða |
|---|---|---:|---|:---:|:---:|
| **Stirge** | `stirge.png` | 1.984.905 B | `ef588a52...` | 27,2 (Dökk) | **APPROVED** |
| **Dire Rat (v2)** | `dire_rat.png` | 1.654.005 B | `5eb9ed69...` | 14,5 (Dökk) | **APPROVED** |
| **Viper** | `viper.png` | 1.912.486 B | `a95fa2f3...` | 22,6 (Dökk) | **APPROVED** |
| **Giant Centipede** | `giant_centipede.png` | 1.760.845 B | `04349da7...` | 12,4 (Dökk) | **APPROVED** |
| **Skeletal Champion** | `skeletal_champion.png` | 1.772.874 B | `942b2425...` | 26,3 (Dökk) | **APPROVED** |

- **Varðveittur galli:** `images/monsters/_archive/dire_rat_v1_white_border.png` (upphafleg v1 útgáfa með hvítum ramma).
- **Yfirlitsmynd Batch 1:** [`public/images/monsters/batch_1_contact_sheet.png`](file:///c:/Users/hih/Documents/antiDark/public/images/monsters/batch_1_contact_sheet.png)
- **QC samanburður:** [`public/images/monsters/dire_rat_qc_comparison.png`](file:///c:/Users/hih/Documents/antiDark/public/images/monsters/dire_rat_qc_comparison.png)

### 4.3 Batch 2: Staðfestar og samþykktar myndir (5 skrímsli — APPROVED):

Notandi hefur formlega skoðað yfirlitsmynd Batch 2 og samþykkt allar 5 myndirnar.

| Skrímsli | Skrá | Stærð | SHA-256 Hash | Jaðarbirta | Staða |
|---|---|---:|---|:---:|:---:|
| **Iron Cobra** | `iron_cobra.png` | 1.593.080 B | `01EEC30056...` | 18,5 (Dökk) | **APPROVED** |
| **Blink Dog** | `blink_dog.png` | 1.406.840 B | `422384E9FB...` | 14,6 (Dökk) | **APPROVED** |
| **Duergar** | `duergar.png` | 1.924.904 B | `FED40D8B0C...` | 40,2 (Dökk) | **APPROVED** |
| **Drow** | `drow.png` | 1.378.373 B | `381FA842A6...` | 15,6 (Dökk) | **APPROVED** |
| **Orc** | `orc.png` | 1.717.223 B | `4F25EF0FD0...` | 27,7 (Dökk) | **APPROVED** |

- **Yfirlitsmynd Batch 2:** [`public/images/monsters/batch_2_contact_sheet.png`](file:///c:/Users/hih/Documents/antiDark/public/images/monsters/batch_2_contact_sheet.png)

### 4.4 Batch 3: Staðfestar og samþykktar myndir (5 skrímsli — APPROVED):

Notandi hefur formlega skoðað yfirlitsmynd Batch 3 og samþykkt allar 5 myndirnar.

| Skrímsli | Skrá | Stærð | SHA-256 Hash | Jaðarbirta | Staða |
|---|---|---:|---|:---:|:---:|
| **Wight** | `wight.png` | 1.651.643 B | `563C6E6FB2...` | 28,4 (Dökk) | **APPROVED** |
| **Harpy** | `harpy.png` | 1.951.576 B | `92C5D98D62...` | 39,0 (Dökk) | **APPROVED** |
| **Doppelganger** | `doppelganger.png` | 1.657.049 B | `7A7B39F55D...` | 21,8 (Dökk) | **APPROVED** |
| **Griffon** | `griffon.png` | 1.487.759 B | `8AD7CCCBF7...` | 10,7 (Dökk) | **APPROVED** |
| **Giant Scorpion** | `giant_scorpion.png` | 1.188.431 B | `2052409AC5...` | 19,7 (Dökk) | **APPROVED** |

- **Yfirlitsmynd Batch 3:** [`public/images/monsters/batch_3_contact_sheet.png`](file:///c:/Users/hih/Documents/antiDark/public/images/monsters/batch_3_contact_sheet.png)

### 4.5 Batch 4: Staðfestar og samþykktar myndir (5 skrímsli — APPROVED):

Notandi hefur formlega skoðað yfirlitsmyndir Batch 4 og endurskoðaða Phase Spider v2 og samþykkt allar 5 myndirnar.

| Skrímsli | Skrá | Stærð | SHA-256 Hash | Jaðarbirta | Staða |
|---|---|---:|---|:---:|:---:|
| **Cloaker** | `cloaker.png` | 1.405.484 B | `1ACC68C332...` | 9,1 (Dökk) | **APPROVED** |
| **Phase Spider (v2)** | `phase_spider.png` | 1.727.648 B | `E8CA2FBF5D...` | 8,8 (Dökk) | **APPROVED** |
| **Wraith** | `wraith.png` | 1.471.327 B | `266E7A033C...` | 8,5 (Dökk) | **APPROVED** |
| **Gibbering Mouther** | `gibbering_mouther.png` | 1.953.124 B | `839F628DD1...` | 18,6 (Dökk) | **APPROVED** |
| **Peryton** | `peryton.png` | 1.673.077 B | `B611A1FC44...` | 18,9 (Dökk) | **APPROVED** |

- **Varðveitt eldri útgáfa (v1 beinagrind):** `images/monsters/_archive/phase_spider_v1_skeletal.png`
- **Endurskoðunarblað:** [`public/images/monsters/phase_spider_grick_revision_sheet.png`](file:///c:/Users/hih/Documents/antiDark/public/images/monsters/phase_spider_grick_revision_sheet.png)
- **Yfirlitsmynd Batch 4 (uppfærð):** [`public/images/monsters/batch_4_contact_sheet.png`](file:///c:/Users/hih/Documents/antiDark/public/images/monsters/batch_4_contact_sheet.png)

### 4.6 Batch 5: Staðfestar og samþykktar myndir (5 skrímsli — APPROVED):

Notandi hefur formlega skoðað yfirlitsmynd Batch 5 og samþykkt allar 5 myndirnar.

| Skrímsli | Skrá | Stærð | SHA-256 Hash | Jaðarbirta | Staða |
|---|---|---:|---|:---:|:---:|
| **Giant Stag Beetle** | `giant_stag_beetle.png` | 2.006.965 B | `66E5707EB9...` | 31,4 (Dökk) | **APPROVED** |
| **Vegepygmy** | `vegepygmy.png` | 1.727.855 B | `80DB77C525...` | 10,0 (Dökk) | **APPROVED** |
| **Ghast** | `ghast.png` | 1.622.686 B | `702A1BEE22...` | 1,1 (Dökk) | **APPROVED** |
| **Giant Bat** | `giant_bat.png` | 1.531.891 B | `1EBAE10A7F...` | 4,9 (Dökk) | **APPROVED** |
| **Morlock** | `morlock.png` | 1.773.157 B | `21C70552AA...` | 19,7 (Dökk) | **APPROVED** |

### 4.7 Batch 6: Staðfestar og samþykktar myndir (5 skrímsli — APPROVED):

Notandi hefur formlega skoðað yfirlitsmyndir Batch 6 og endurskoðaðan Grick v2 og samþykkt allar 5 myndirnar.

| Skrímsli | Skrá | Stærð | SHA-256 Hash | Jaðarbirta | Staða |
|---|---|---:|---|:---:|:---:|
| **Violet Fungus** | `violet_fungus.png` | 1.925.861 B | `354EA978B0...` | 15,8 (Dökk) | **APPROVED** |
| **Grick (v2)** | `grick.png` | 1.882.755 B | `ACBD5963C4...` | 32,9 (Dökk) | **APPROVED** |
| **Krenshar** | `krenshar.png` | 2.064.474 B | `F441E5EFEF...` | 20,7 (Dökk) | **APPROVED** |
| **Bunyip** | `bunyip.png` | 1.819.524 B | `85C4B84EE5...` | 16,3 (Dökk) | **APPROVED** |
| **Sahuagin** | `sahuagin.png` | 2.105.003 B | `838B6B9C67...` | 18,4 (Dökk) | **APPROVED** |

- **Varðveitt eldri útgáfa (v1 snákakennd):** `images/monsters/_archive/grick_v1_snakelike.png`
- **Endurskoðunarblað:** [`public/images/monsters/phase_spider_grick_revision_sheet.png`](file:///c:/Users/hih/Documents/antiDark/public/images/monsters/phase_spider_grick_revision_sheet.png)
- **Yfirlitsmynd Batch 6 (uppfærð):** [`public/images/monsters/batch_6_contact_sheet.png`](file:///c:/Users/hih/Documents/antiDark/public/images/monsters/batch_6_contact_sheet.png)

### 4.8 Sameiginleg yfirlitsmynd (Master Contact Sheet — öll 30 skrímslin):
Öll 30 nýju skrímslin hafa nú fengið raunverulegar, einstakar myndir og verið samþykkt af notanda:
- **0 skrímsli bíða (0 MISSING ARTWORK / 0 PLACEHOLDERS)**
- **30 skrímsli APPROVED (Öll 30 nýju skrímslin staðfest og formlega samþykkt af notanda)**
- **0 skrímsli REVIEW REQUIRED**
- **Master Contact Sheet (30 monsters):** [`public/images/monsters/master_30_monsters_contact_sheet.png`](file:///c:/Users/hih/Documents/antiDark/public/images/monsters/master_30_monsters_contact_sheet.png)

---

## 🎨 5. Undirbúningur myndagerðar: Image Prompts

Myndagerðarverkfærið (`image-generator` subagent) er **aðgengilegt og til staðar** í vinnuumhverfinu.

Samkvæmt [`docs/monster-art-style.md`](monster-art-style.md) hefur verið samið sérstakt, ítarlegt prompt fyrir hvert og eitt af skrímslunum 30. Öll prompt fylgja staðlaðri Darkgrid stílforskrift:
- **Snið:** Hand-painted 2D digital art style, painterly, dark fantasy RPG bestiary illustration.
- **Uppsetning:** 1:1 ferningur, miðlæg skepna, öll veran sýnileg frá toppi til táar með 15–20% öryggisbil (generous margins).
- **Lýsing og litir:** Dökk jarðlitapalletta, lágstemmd birtustig, jaðarlýsing (rim lighting), engin neon-ofmettun.
- **Bann:** Enginn texti, engin lógó, engir rammar, engin vatnsmerki.
- **Full-Bleed krafa (NÝTT QC SKILYRÐI):** Dökkur bakgrunnur verður að ná 100% órofinn út í öll fjögur horn og alla kanta (seamless dark vignette edge falloff). Engir hvítir eða ljósir kantar, engir pappírsjaðrar (paper margins), engir listar eða rammalínur.

### 📋 Fullkominn listi yfir prompts fyrir öll 30 skrímslin:

#### 1. Stirge (CR 0.5 • Magical Beast • Habitat: Swamp)
```text
Dark fantasy RPG bestiary illustration of a Stirge, a parasitic winged beast. A grotesque fiend combining the bloated rust-red abdomen of an oversized mosquito with leathery bat-like wings, four spindly insectoid clinging legs, and a rigid, razor-sharp needle-like feeding proboscis. Hovering in a predatory tilt. Hand-painted 2D digital art style, atmospheric, ominous, muted peat browns, rust red and bruised plum palette with subtle crimson fluid gleam on the proboscis, dark moody lighting with subtle atmospheric rim highlights. Painterly digital painting, clear silhouette, centered subject, full creature visible from head to toe with generous margins. Dark vignette misty stagnant swamp waters with decaying trees background, full-bleed dark canvas extending to all edges, no text, no borders, no frame, no watermark.
```

#### 2. Dire Rat (v2 - Hardened Full-Bleed) (CR 0.33 • Animal • Habitat: Underground Ruins)
```text
Full-bleed dark fantasy 2D digital painting of a Dire Rat, a vicious predatory oversized rodent. A three-foot-long muscular sewer rat bristling with coarse, greasy matted charcoal-brown fur, weeping infected sores and scabs, elongated curved yellow incisors dripping rancid drool, vicious snarl, glowing diseased amber eyes, and a long scaly segmented tail. Stalking low across dark wet stone flagstones. Hand-painted 2D digital art style, low-key atmospheric lighting, deep charcoal, murky sepia, and soiled loam earth palette with subtle diseased amber eye gleam, subtle cool atmospheric rim lighting. Centered subject with generous margins, full creature including head, paws, and tail completely visible. CRITICAL: Full-bleed dark digital canvas with pitch-black and dark shadowy sewer background extending completely to all four edges and corners (seamless dark edge falloff). ABSOLUTELY NO white borders, NO paper edges, NO parchment borders, NO picture frame, NO border lines, NO matting, NO text, NO watermark.
```

#### 3. Viper (CR 0.5 • Animal • Habitat: Forest)
```text
Dark fantasy RPG bestiary illustration of a Viper, a deadly venomous pit viper. A thick-bodied serpent coiled tightly like a spring, covered in diamond-patterned iridescent dark olive-green and black scales, a wide triangular horned head with vertical slit amber eyes, and flared jaws revealing twin translucent dripping hollow fangs and a forked black tongue. Hand-painted 2D digital art style, atmospheric, ominous, muted dark moss greens, wet loam black, and lichen slate palette with subtle venomous emerald and amber eye gleam, dark moody lighting with subtle atmospheric rim highlights. Painterly digital painting, clear silhouette, centered subject, full creature visible from head to tail with generous margins. Dark vignette misty ancient forest floor with damp rotting bark background, no text, no borders, no frame, no watermark.
```

#### 4. Giant Centipede (CR 0.5 • Vermin • Habitat: Underground Ruins)
```text
Dark fantasy RPG bestiary illustration of a Giant Centipede, a predatory subterranean vermin. A six-foot-long segmented monstrosity armored in polished rust-brown and chitinous black plates, dozens of pale scuttling jointed legs undulating in motion, rearing its armored forebody to reveal hollow curved venomous mandibles and twitching sensory antennae. Hand-painted 2D digital art style, atmospheric, ominous, muted burnt umber, chitin black, and dusty clay palette with subtle sickly bile-green gleam upon the mandible tips, dark moody lighting with subtle atmospheric rim highlights. Painterly digital painting, clear silhouette, centered subject, full creature visible from head to tail with generous margins. Dark vignette misty subterranean cavern stones and dripping stalagmites background, no text, no borders, no frame, no watermark.
```

#### 5. Iron Cobra (CR 2 • Construct • Habitat: Underground Ruins)
```text
Dark fantasy RPG bestiary illustration of an Iron Cobra, an arcane clockwork serpent construct. An articulated automaton crafted from dark overlapping iron and dull bronze scale-plates with exposed oiled brass joints, rearing in an ominous cobra hood, featuring glowing faceted ruby gemstone optical eyes and segmented articulated steel fangs designed to inject liquid poison. Hand-painted 2D digital art style, atmospheric, ominous, muted tarnished iron, soot black, and antique bronze palette with glowing crimson ruby eye accents, dark moody lighting with cold metallic edge rim highlights. Painterly digital painting, clear silhouette, centered subject, full creature visible from head to tail with generous margins. Dark vignette misty ruined arcane vault with cracked tiled floor background, no text, no borders, no frame, no watermark.
```

#### 6. Skeletal Champion (CR 2 • Undead • Habitat: Underground Ruins)
```text
Dark fantasy RPG bestiary illustration of a Skeletal Champion, an elite undead warrior. An ancient bleached skeleton possessed by dark martial intelligence, clad in battered rusted blackened iron chainmail and breastplate, holding a notched battle-worn longsword in two-handed stance with an iron-rimmed shield on its back, glowing twin pinpoints of cold hateful crimson fire burning within the black hollows of its eye sockets. Hand-painted 2D digital art style, atmospheric, ominous, muted bone ivory, rusted iron brown, and ash slate palette with glowing crimson sorcerous eye-fire highlights, dark moody lighting with atmospheric rim highlights. Painterly digital painting, clear silhouette, centered subject, full creature visible from head to toe with generous margins. Dark vignette misty ancient crypt stones and broken tombstones background, no text, no borders, no frame, no watermark.
```

#### 7. Blink Dog (CR 2 • Magical Beast • Habitat: Plains)
```text
Dark fantasy RPG bestiary illustration of a Blink Dog, an elusive telekinetic canid beast. A sleek, muscular hound with short sandy-brown and dun fur, large pointed alert ears, intelligent watchful golden eyes, surrounded by faint crackling blue dimensional static and subtle blurred ghostly displacement around its paws and spine as it shifts between planes. Poised in a protective low stance. Hand-painted 2D digital art style, atmospheric, ominous, muted tawny ochre, weathered dust, and charcoal palette with ethereal pale azure phase-spark accents, dark moody lighting with subtle dimensional rim highlights. Painterly digital painting, clear silhouette, centered subject, full creature visible from head to tail with generous margins. Dark vignette misty nocturnal windswept plains with jagged standing stones background, no text, no borders, no frame, no watermark.
```

#### 8. Duergar (CR 0.33 • Humanoid • Habitat: Underground Ruins)
```text
Dark fantasy RPG bestiary illustration of a Duergar, a cruel gray dwarf of the deep underworld. A stocky, heavily muscled dwarven warrior with ashen-gray stone-like skin, stark unkempt white beard and hair, cold merciless sunken black eyes, clad in dark utilitarian scale armor and spiked iron greaves, wielding a heavy square-headed iron warhammer and a dented iron tower shield. Scowling in grim defiance. Hand-painted 2D digital art style, atmospheric, ominous, muted ash gray, dull iron, and deep charcoal palette with subtle pale sulfur eye glint, dark moody lighting with sharp cold rim highlights. Painterly digital painting, clear silhouette, centered subject, full creature visible from head to toe with generous margins. Dark vignette misty deep underground cavern with basalt pillars background, no text, no borders, no frame, no watermark.
```

#### 9. Drow (CR 0.33 • Humanoid • Habitat: Underground Ruins)
```text
Dark fantasy RPG bestiary illustration of a Drow, a lethal dark elven scout. A slender, graceful elf with obsidian-black skin, long stark snow-white hair, sharp angular features, and pale lilac eyes burning with cold malice, wearing fitted dark leather armor lined with spider motifs, holding a poised masterwork rapier in one hand and a miniature hand crossbow loaded with a glistening poisoned bolt in the other. Hand-painted 2D digital art style, atmospheric, ominous, muted midnight black, deep slate, and withered leather palette with subtle luminescent lilac eye gleam and faint purple poison sheen, dark moody lighting with subtle atmospheric rim highlights. Painterly digital painting, clear silhouette, centered subject, full creature visible from head to toe with generous margins. Dark vignette misty subterranean fungal cave with stalactites background, no text, no borders, no frame, no watermark.
```

#### 10. Orc (CR 0.33 • Humanoid • Habitat: Hills)
```text
Dark fantasy RPG bestiary illustration of an Orc, a ferocious tribal warrior. A hulking, brutish humanoid with coarse grayish-green hide, heavy brow ridge, piggish red-rimmed eyes, two large yellowed tusks protruding upward from the lower jaw, wearing rough fur, bone trinkets, and piecemeal iron armor, clutching a massive notched two-handed iron falchion with savage intent. Hand-painted 2D digital art style, atmospheric, ominous, muted olive-gray hide, greasy pelt brown, and rusted steel palette with blood-red eye gleam, dark moody lighting with harsh rim highlights. Painterly digital painting, clear silhouette, centered subject, full creature visible from head to toe with generous margins. Dark vignette misty rocky highland crags with dead brush background, no text, no borders, no frame, no watermark.
```

#### 11. Wight (CR 3 • Undead • Habitat: Underground Ruins)
```text
Dark fantasy RPG bestiary illustration of a Wight, a malevolent barrow-corpse. A desiccated humanoid mummy-like undead with tight, shriveled leathery gray-black flesh clinging to withered cords of muscle and protruding ribs, ragged burial shrouds, wild white wisps of hair, feral bared needle-teeth, and long blackened needle-sharp necrotic claws, its deep sunken eye sockets burning with twin points of cruel pale-blue corpse-light. Hand-painted 2D digital art style, atmospheric, ominous, muted desiccated gray, shroud charcoal, and rot-earth palette with piercing cyan-blue eye glow, dark moody lighting with ghostly rim highlights. Painterly digital painting, clear silhouette, centered subject, full creature visible from head to toe with generous margins. Dark vignette misty ancient barrow mound with cracked sarcophagus background, no text, no borders, no frame, no watermark.
```

#### 12. Harpy (CR 4 • Monstrous Humanoid • Habitat: Mountains)
```text
Dark fantasy RPG bestiary illustration of a Harpy, a foul avian abomination. A grotesque winged crone combining the emaciated torso and withered, screeching face of an aged hag with the ragged, soiled dark-feathered wings of a vulture, filthy matted black hair, and powerful scaly avian legs terminating in wicked curved black talons, crouching ready to launch into flight. Hand-painted 2D digital art style, atmospheric, ominous, muted vulture brown, soiled bone gray, and oily feather black palette with sunken yellow eye glint, dark moody lighting with windblown rim highlights. Painterly digital painting, clear silhouette, centered subject, full creature visible from head to toe with generous margins. Dark vignette misty jagged mountain precipice and fog-shrouded peaks background, no text, no borders, no frame, no watermark.
```

#### 13. Doppelganger (CR 3 • Monstrous Humanoid • Habitat: Underground Ruins)
```text
Dark fantasy RPG bestiary illustration of a Doppelganger, an uncanny shapechanging infiltrator. A hairless, uncanny humanoid with smooth, moist clay-gray skin, indistinct melting facial features devoid of nose or lips, large slitted blank yellow cat-like eyes, and elongated dexterous fingers ending in dense cartilaginous knuckles, caught in mid-transition between identities. Hand-painted 2D digital art style, atmospheric, ominous, muted clay gray, putty beige, and shadowy slate palette with cold pale yellow eye accents, dark moody lighting with subtle atmospheric rim highlights. Painterly digital painting, clear silhouette, centered subject, full creature visible from head to toe with generous margins. Dark vignette misty damp stone corridor with flickering shadows background, no text, no borders, no frame, no watermark.
```

#### 14. Griffon (CR 4 • Magical Beast • Habitat: Hills)
```text
Dark fantasy RPG bestiary illustration of a Griffon, a majestic apex aerial predator. A powerful beast possessing the head, forelegs, and feathered wings of a colossal predatory eagle with a sharp hooked golden-black beak and fierce raptor eyes, seamlessly blending into the muscular hindquarters, tawny pelt, and tufted whip-tail of a heavy lion. Hand-painted 2D digital art style, atmospheric, ominous, muted tawny gold, mottled raptor feather brown, and charcoal gray palette with piercing amber eye glint, dark moody lighting with sweeping rim highlights on plumage. Painterly digital painting, clear silhouette, centered subject, full creature visible from beak to tail with generous margins. Dark vignette misty windswept mountain plateau with craggy peaks background, no text, no borders, no frame, no watermark.
```

#### 15. Giant Scorpion (CR 3 • Vermin • Habitat: Desert)
```text
Dark fantasy RPG bestiary illustration of a Giant Scorpion, a titanic predatory arachnid. A massive, nine-foot-long desert horror armored in heavy segmented dull black-brown chitin plates, dual colossal crushing pincer-claws raised in defense, eight multi-jointed walking legs, and a thick segmented tail arched gracefully over its back with a wicked curved bulbous stinger glistening with clear viscous toxin. Hand-painted 2D digital art style, atmospheric, ominous, muted basalt black, scorched sand umber, and arid dust palette with subtle amber-green gleam on venom drop, dark moody lighting with sharp chitinous edge rim highlights. Painterly digital painting, clear silhouette, centered subject, full creature visible from claws to stinger with generous margins. Dark vignette misty windswept rocky desert dunes at dusk background, no text, no borders, no frame, no watermark.
```

#### 16. Cloaker (CR 5 • Aberration • Habitat: Underground Ruins)
```text
Dark fantasy RPG bestiary illustration of a Cloaker, a sinister subterranean aberration. A bizarre ray-like predatory creature with a thick, leathery black-and-slate hide resembling a heavy tattered traveling cloak, unfurling its undulating mantle to reveal a hideous central face with glowing red saucer eyes, a gaping maw lined with multiple rows of needle-sharp ivory teeth, clawed clasps along its edges, and a long segmented whip-tail. Floating silently in midair. Hand-painted 2D digital art style, atmospheric, ominous, muted velvet black, leather slate, and bruised mauve palette with malevolent ruby eye gleam, dark moody lighting with soft ethereal rim highlights. Painterly digital painting, clear silhouette, centered subject, full creature visible from mantle to tail with generous margins. Dark vignette misty vaulted subterranean cavern with stalactites background, no text, no borders, no frame, no watermark.
```

#### 17. Phase Spider (CR 5 • Magical Beast • Habitat: Underground Ruins)
```text
Dark fantasy RPG bestiary illustration of a Phase Spider, an ethereal interdimensional arachnid. An eight-foot-long spider with a pale, pearlescent ghostly blue-white exoskeleton, an eerie semi-humanoid skull-face etched into its cephalothorax, multiple multifaceted black eyes, long spindly jointed legs trailing wisps of glowing dimensional mist, and elongated dripping fangs charged with toxic phase venom. Hand-painted 2D digital art style, atmospheric, ominous, muted pale spectral blue, bone white, and dark cosmic slate palette with glowing ethereal cyan mist accents, dark moody lighting with shimmering planar rim highlights. Painterly digital painting, clear silhouette, centered subject, full creature visible from head to legs with generous margins. Dark vignette misty rift between stone dungeon walls and shimmering astral void background, no text, no borders, no frame, no watermark.
```

#### 18. Wraith (CR 5 • Undead • Habitat: Underground Ruins)
```text
Dark fantasy RPG bestiary illustration of a Wraith, a horrifying incorporeal spirit of pure hatred. A towering, spectral figure draped in tattered robes of semi-transparent shadow and swirling black mist, possessing no physical face beneath its dark cowl except for two blazing pinpoints of malevolent scarlet fire, with elongated smoky skeletal hands and vaporous talons reaching hungrily forward. Hand-painted 2D digital art style, atmospheric, ominous, muted abyssal black, smoke gray, and spectral indigo palette with intense burning crimson eye highlights, dark moody lighting with ghostly ethereal rim glow. Painterly digital painting, clear silhouette, centered subject, full creature visible from cowl to trailing mist with generous margins. Dark vignette misty desecrated tomb with crumbling masonry background, no text, no borders, no frame, no watermark.
```

#### 19. Gibbering Mouther (CR 5 • Aberration • Habitat: Underground Ruins)
```text
Dark fantasy RPG bestiary illustration of a Gibbering Mouther, an amorphous eldritch monstrosity. A writhing, shifting mound of translucent, weeping protoplasmic flesh and glistening gelatinous sludge, sprouting dozens of mismatched human-like and animal eyes that blink erratically, and innumerable fanged chattering mouths babbling in discordant madness, dripping thick caustic spittle as it surges across the stone. Hand-painted 2D digital art style, atmospheric, ominous, muted bruised plum, sickly bile-tinged ochre, and putrid meat pink palette with glistening wet highlights and bloodshot eye accents, dark moody lighting with sickening rim highlights. Painterly digital painting, clear silhouette, centered subject, full creature visible with generous margins. Dark vignette misty slime-slick dungeon flagstones with dripping walls background, no text, no borders, no frame, no watermark.
```

#### 20. Peryton (CR 4 • Magical Beast • Habitat: Mountains)
```text
Dark fantasy RPG bestiary illustration of a Peryton, a chimeric flying omen of death. A bizarre predator combining the muscular body and head of a dark stag with jagged, wicked obsidian-black antlers, the feathered wings and body plumage of a massive dark-purple and dusky-blue bird of prey, powerful taloned eagle foreclaws, and cloven rear hooves, casting an unsettling human-shaped shadow beneath it. Hand-painted 2D digital art style, atmospheric, ominous, muted dark stag brown, iridescent night-sky purple, and obsidian black palette with cold amber eye gleam, dark moody lighting with windblown rim highlights on feathers and horn tips. Painterly digital painting, clear silhouette, centered subject, full creature visible from antlers to hooves with generous margins. Dark vignette misty jagged mountain crag shrouded in storm clouds background, no text, no borders, no frame, no watermark.
```

#### 21. Giant Stag Beetle (CR 4 • Vermin • Habitat: Forest)
```text
Dark fantasy RPG bestiary illustration of a Giant Stag Beetle, a massive armored insect brute. A ten-foot-long colossus clad in thick, glossy iridescent midnight-blue and black chitin armor, sporting immense, branching serrated antler-like mandibles that thrust forward like twin timber-cleavers, with six heavy hooked chitinous legs planted firmly on the ground. Hand-painted 2D digital art style, atmospheric, ominous, muted beetle carapace indigo, soot black, and damp bark brown palette with subtle metallic blue sheen highlights along shell ridges, dark moody lighting with crisp edge rim highlights. Painterly digital painting, clear silhouette, centered subject, full creature visible from mandibles to abdomen with generous margins. Dark vignette misty primordial forest floor surrounded by giant mossy roots background, no text, no borders, no frame, no watermark.
```

#### 22. Vegepygmy (CR 0.5 • Plant • Habitat: Swamp)
```text
Dark fantasy RPG bestiary illustration of a Vegepygmy, a primitive fungal humanoid. A small, three-foot-tall tribal plant creature composed of dense fibrous roots, rubbery greenish-brown lichen, and fungal shelf plates, with a face formed of knotted woody bark, tiny dark hollows for eyes, and leafy spore tendrils crowning its head, clutching a crudely lashed stone-tipped hunting spear. Hand-painted 2D digital art style, atmospheric, ominous, muted lichen green, decaying mulch brown, and fungal ochre palette with subtle pale spore dust accents, dark moody lighting with earthy atmospheric rim highlights. Painterly digital painting, clear silhouette, centered subject, full creature visible from head to toe with generous margins. Dark vignette misty subterranean fungal swamp with giant puffballs background, no text, no borders, no frame, no watermark.
```

#### 23. Ghast (CR 2 • Undead • Habitat: Underground Ruins)
```text
Dark fantasy RPG bestiary illustration of a Ghast, a superior predatory ghoul abomination. A feral, emaciated humanoid undead with blotched pale-gray rotting skin, elongated pointed ears, a distended jaw filled with jagged broken teeth dripping foul paralytic venom, filthy elongated fingers ending in wicked dark claws, crouched on all fours surrounded by a sickening visible haze of carrion stench. Hand-painted 2D digital art style, atmospheric, ominous, muted corpse gray, rotted olive, and bruised purple palette with sickly yellowed eye glint and faint greenish stench vapors, dark moody lighting with eerie rim highlights. Painterly digital painting, clear silhouette, centered subject, full creature visible from head to toe with generous margins. Dark vignette misty forgotten charnel vault with scattered bone fragments background, no text, no borders, no frame, no watermark.
```

#### 24. Giant Bat (CR 2 • Animal • Habitat: Underground Ruins)
```text
Dark fantasy RPG bestiary illustration of a Giant Bat, a colossal subterranean chiropteran hunter. A massive flying creature with a five-foot muscular body covered in dark bristling mahogany and charcoal fur, a fierce snarling vulpine muzzle with sharp needle fangs and large membranous leaf-nose sensory ears, spreading ten-foot leathery translucent wings tipped with hooked clinging claws. Hand-painted 2D digital art style, atmospheric, ominous, muted mahogany fur, leathery charcoal slate, and soot black palette with glinting red-rimmed eye accents, dark moody lighting with translucent backlighting along wing membranes. Painterly digital painting, clear silhouette, centered subject, full creature visible from wingtip to wingtip with generous margins. Dark vignette misty damp limestone cave roof with hanging stalactites background, no text, no borders, no frame, no watermark.
```

#### 25. Morlock (CR 2 • Monstrous Humanoid • Habitat: Underground Ruins)
```text
Dark fantasy RPG bestiary illustration of a Morlock, a degenerate subterranean hunter. A savage, hunched subterranean humanoid with stark chalk-white hairless skin, wiry elongated limbs, an animalistic predatory posture, huge milky bulbous eyes adapted for total darkness, and sharp needle-like filed teeth, clutching a brutal serrated bone-and-flint club. Hand-painted 2D digital art style, atmospheric, ominous, muted albino flesh, mineral dust gray, and subterranean grime palette with pale luminescent milky eye reflection, dark moody lighting with harsh stone-carved rim highlights. Painterly digital painting, clear silhouette, centered subject, full creature visible from head to toe with generous margins. Dark vignette misty deep underground ruined stone arches and rubble background, no text, no borders, no frame, no watermark.
```

#### 26. Violet Fungus (CR 3 • Plant • Habitat: Underground Ruins)
```text
Dark fantasy RPG bestiary illustration of a Violet Fungus, a predatory subterranean plant. A four-foot-tall bulbous mushroom cap of deep mottled violet and bruised purple flesh, supported by a thick slimy grayish stalk, with four long whip-like thorny tentacles emerging from beneath the cap, coiled to lash out, the tips oozing viscous acid that burns the stone below. Hand-painted 2D digital art style, atmospheric, ominous, muted deep royal purple, fungal mauve, and slimy ash gray palette with bright acid-droplet caustic highlights, dark moody lighting with subtle moist rim highlights. Painterly digital painting, clear silhouette, centered subject, full creature visible from cap to base with generous margins. Dark vignette misty damp underground cavern floor with moldering organic matter background, no text, no borders, no frame, no watermark.
```

#### 27. Grick (CR 2 • Aberration • Habitat: Underground Ruins)
```text
Dark fantasy RPG bestiary illustration of a Grick, a serpentine subterranean ambush predator. A heavy, worm-like aberration with thick, rubbery slate-gray and mottled olive hide, coiled tightly on rocks, bearing a central head dominated by a sharp, snapping parrot-like horn beak surrounded by four writhing, segmented tentacles lined with barbed claws. Hand-painted 2D digital art style, atmospheric, ominous, muted slate gray, murky olive, and wet rock palette with dull ivory beak highlights and subtle slime sheen, dark moody lighting with soft atmospheric rim highlights. Painterly digital painting, clear silhouette, centered subject, full creature visible from tentacles to tail with generous margins. Dark vignette misty underground cavern boulders and dark fissures background, no text, no borders, no frame, no watermark.
```

#### 28. Krenshar (CR 1 • Magical Beast • Habitat: Forest)
```text
Dark fantasy RPG bestiary illustration of a Krenshar, a terrifying predatory beast. A cat-like feline carnivore with a supple leopard-shaped body of short mottled dun-and-brown fur, caught in the gruesome act of pulling back the skin and fur of its head like an unnatural mask, revealing bare glistening red facial musculature, white skull bone, and snarling needle-teeth to induce primal panic. Hand-painted 2D digital art style, atmospheric, ominous, muted tawny cat pelt, loam brown, and raw crimson muscle palette with stark ivory bone and wild amber eye gleam, dark moody lighting with dramatic rim highlights. Painterly digital painting, clear silhouette, centered subject, full creature visible from head to tail with generous margins. Dark vignette misty twilight forest clearing with twisted gnarled trunks background, no text, no borders, no frame, no watermark.
```

#### 29. Bunyip (CR 3 • Magical Beast • Habitat: River / Lake)
```text
Dark fantasy RPG bestiary illustration of a Bunyip, a ferocious amphibious chimera. A massive aquatic terror combining the sleek, blubbery dark-brown and wet gray body of an oversized sea lion with the blunt, brutal head and gaping jaws of a great predatory shark, filled with multi-tiered serrated triangular teeth, swimming low in dark water with webbed flippers churning the surface. Hand-painted 2D digital art style, atmospheric, ominous, muted wet pelt brown, river sludge gray, and deep murky green palette with glistening ivory teeth and blood-tinged water accents, dark moody lighting with watery caustic rim highlights. Painterly digital painting, clear silhouette, centered subject, full creature visible from snout to rear flipper with generous margins. Dark vignette misty moonlit murky riverbank with reeds background, no text, no borders, no frame, no watermark.
```

#### 30. Sahuagin (CR 2 • Monstrous Humanoid • Habitat: Coast)
```text
Dark fantasy RPG bestiary illustration of a Sahuagin, a vicious aquatic devil of the deep. A predatory humanoid covered in glistening dark emerald and sea-green scales with pale underbelly, a dorsal fin running down its spine, webbed clawed hands, a shark-like head with black unblinking bulbous eyes and multiple rows of needle teeth, brandishing a heavy coral-tipped trident adorned with shark teeth. Poised in a crouching combat stance. Hand-painted 2D digital art style, atmospheric, ominous, muted deep sea-green, ocean trench teal, and barnacle ivory palette with pale yellow underbelly and coral pink trident accents, dark moody lighting with shimmering underwater rim highlights. Painterly digital painting, clear silhouette, centered subject, full creature visible from crest to finned feet with generous margins. Dark vignette misty rocky coastal shore at night with crashing surf background, no text, no borders, no frame, no watermark.
```

---

## 🛠️ 6. Styrkt gæðaeftirlitsferli fyrir myndagerð (Strengthened QC Workflow)

Til að tryggja að gallar eins og hvítir/ljósir rammar, skertar útlínur eða stílfrávik komist aldrei aftur í gegn, hefur ferlið fyrir allar komandi lotur (Batches 2–6) verið uppfært í strangan **7-þrepa gæðastaðal**:

### 7-þrepa vinnuferli:
1. **Generate (Myndagerð):**  
   Keyra `image-generator` með hertu full-bleed prompti sem útilokar sérstaklega hvíta ramma, pappírsáferðir og jaðarlínur.
2. **Validate Dimensions & File Integrity:**  
   Staðfesta 1024×1024 upplausn, 1:1 hlutfall og PNG skráarsnið á báðum stöðum (`images/monsters/` og `public/images/monsters/`).
3. **Check for Duplicate / Placeholder Images:**  
   Reikna SHA-256 hash. Sannreyna að myndin sé ekki afrit af Feral Wolf né neinni annarri mynd á diski.
4. **Visual & Algorithmic Style Inspection:**  
   - Framkvæma sjónræna skoðun með `view_file` (multimodal vision).
   - Reikna jaðarbirtu (edge brightness audit): Average edge brightness verður að vera < 40 (dökkir jaðrar).
   - Athuga 15–20% öryggisbil, 2D handmálaðan stíl, líffærafræði skv. Pathfinder 1e og litatóna.
5. **Flag Issues (Gallaflokkun):**  
   Ef mynd sýnir ljósa ramma, afskorinn líkama eða stílfrávik er hún merkt **REJECTED**, gallinn greindur, eldri útgáfa varðveitt í `_archive/` og ný mynd búin til.
6. **Present Contact Sheet (Yfirlitsmynd):**  
   Búa til samsetta yfirlitsmynd (Contact Sheet) af lotunni og birta notanda með stöðunni **REVIEW REQUIRED**.
7. **Mark Artwork APPROVED Only Upon Confirmation:**  
   Mynd er **ALDREI** merkt **APPROVED** eingöngu vegna þess að skrá er til eða hash er einstakt. Hún er eingöngu merkt **APPROVED** eftir að notandi hefur sjálfur skoðað og gefið skýrt samþykki.

---

## 🚦 7. Flokkunarkerfi stöðu (Lifecycle States)

- **`MISSING`**: Engin raunveruleg mynd er til (aðeins eldra placeholder).
- **`GENERATED`**: Mynd hefur verið búin til og tæknilegar stærðir staðfestar.
- **`REVIEW REQUIRED`**: Mynd hefur staðist sjálfvirka jaðarskoðun og bíður yfirferðar notanda á contact sheet.
- **`APPROVED`**: Notandi hefur samþykkt myndina formlega. Engin lota heldur áfram fyrr en fyrri lota er APPROVED.
