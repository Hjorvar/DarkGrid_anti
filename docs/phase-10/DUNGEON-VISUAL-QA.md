# Phase 10 — Agent E: Sjónrænar Umbætur á Dýflissum & Gæðaprófanir (Dungeon Visual QA)

## 1. Yfirlit Verkefnis

Í **Phase 10 (Agent E — Dungeon Visual Improvements)** var sjónræn framsetning beggja neðanjarðardýflissanna í DarkGrid — **The Goblin Cave** (`GOBLIN_CAVE`, `20×18 = 360` reitir) og **The Ancient Crypt** (`ANCIENT_CRYPT`, `20×19 = 380` reitir) — endurhönnuð og uppfærð í 2D top-down teiknivélinni (`action-ui-lab/public/js/world/topdown-renderer.js`) og viðmótsstílnum (`action-ui-lab/public/css/world.css`), án þess að hrófla við leikreglum um sýnileikageisla, sjónlínu (Line-of-Sight) eða þriggja-þrepa þoku (Fog of War).

---

## 2. Helstu Sjónrænar Umbætur

### 2.1 Betri steinveggir, gólf og skýrari gangar og herbergi
- **2.5D dýpt í veggjum (`drawDungeonWallTile`):** Steinveggir eru nú teiknaðir með upphækkuðum toppfleti (crown face), lóðréttri framhlið (south-facing wall facade) þar sem veggur liggur að gengilegu gólfi fyrir sunnan, og skörpum steinbrúnum (beveled stone curbs) á öllum hliðum sem mæta gangi eða sal.
- **Stefnuvirkir dýptarskuggar (`Ambient Occlusion Drop-Shadows`):** Gengileg gólf draga mjúka skugga frá aðliggjandi veggjum í norðri, suðri, austri og vestri, sem gerir ganga, horn og herbergi samstundis læsileg og aðgreinanleg frá ófærum veggjum.
- **Áferð á gólfum (`drawDungeonFloorAndProps`):** Herbergi (`CHAMBER`), Boss-helgidómar (`BOSS_SANCTUM`) og þröngir gangar hafa ólíka birtu, steinfúgur, sprungur og innfelld mynstur.

### 2.2 Sterkur sjónrænn munur á Goblin Cave og Ancient Crypt
| Eiginleiki | The Goblin Cave (`GOBLIN_CAVE`) | The Ancient Crypt (`ANCIENT_CRYPT`) |
| :--- | :--- | :--- |
| **Veggir & Berglög** | Hrjúfir jarðbrúnir klettaveggir, sprungur, mosablettir og **viðarstoðir** (`timber shoring beams`) í göngum. | Tilhöggnir kaldir granít-/marmarasteinar (ashlar masonry), **gotneskar grafhvelfingar**, **hauskúpu-lágmyndir** og **bláglóandi rúnasteinar**. |
| **Gólf & Skrautmunir** | Slitin kalksteinsgólf, **blágrænir lýsandi sveppir** (bioluminescent fungi), **beinagrindaleifar**, **hengibrú úr timbri og reipum**, og vopnagrindur. | Slípaðar steinflísar, **purpurarauður og smaragðsgrænn dregill** eftir miðju (Pillared Crypt Nave), **flautaðar steinsúlur**, **steinkistur (sarcophagi)** og bronsgrindur. |
| **Lýsing & Litapalletta** | Hlýtt, flöktandi **gulbrúnt/appelsínugult kyndilskin** (`rgba(251, 191, 36)` / `rgba(234, 88, 12)`). | Kalt **blá-fjólublátt, föl-gullin og smaragðsgrænt grafhýsaljós** (`rgba(56, 189, 248)` / `rgba(52, 211, 153)`). |

### 2.3 Skýr tákn og sjónræn endurgjöf fyrir alla viðburði í dýflissum
- **Inngangs- og útgangsstigar (`EXIT_STAIRS` / `DUNGEON_EXIT`):** Niðurgrafinn steinstigi með fimm þrepum í dýptarskugga, gylltum ramma og skýrri ör sem vísar upp á yfirborðið.
- **Varðstöðvar og bardagar (`GUARD_POST` / `fixedEncounterKey`):** Krosslögð sverð yfir varðhring með glóandi varðeldi í miðju (sem dofnar í grátt þegar varðstöð hefur verið hreinsuð).
- **Fjársjóðskistur (`TREASURE_CACHE`):** Járn- og gullbryddaðar eikarkistur (eða silfurskrín í Ancient Crypt) með gullnum lás, ljóma og glitrandi stjörnum þegar þær eru óopnaðar, en opnu dökku loki þegar fjársjóðurinn hefur verið tekinn.
- **Helgidómar (`CAVE_FUNGAL_SHRINE` & `CRYPT_ROYAL_OFFERING`):** Steinalltari með glóandi kristal/bikar og geimabirtu.
- **Gildrur og umhverfishættur (`HAZARD_*`):**
  - `HAZARD_BONE_SPIKES`: Hvassir beinbroddar með rauðum oddum sem rísa úr gólfinu.
  - `HAZARD_SPIDER_WEBS`: Sammiðja kóngulóarvefur strengdur yfir ganginn.
  - `HAZARD_CURSED_BRAZIER`: Járneldstó á þrífæti með fjólubláum og smaragðsgrænum sálareldi.
  - `HAZARD_NECROTIC_MIST`: Eitraður dauðaþoku-gufustrókur.
- **Boss-helgidómar (`DUNGEON_BOSS`):**
  - `[16, 2]` í Goblin Cave (**Skulkrip the Cave Brood-King**): Blóðrauður og gulbrúnn galdrahringur, fjórar eldstór í hornum og gullin kórónutáknmynd.
  - `[10, 2]` í Ancient Crypt (**Lord Malakor the Barrow-Wight King**): Smaragðsgrænn og fjólublár rúnahringur, fjórar sálareldstór og kórónutáknmynd.

### 2.4 Varðveisla á leikreglum og `#050508` myrkri
- **Sýnileikageisli:** Óbreyttur — **2 reitir fyrir Fighter og Cleric**, **3 reitir fyrir Ranger**.
- **Sjónlína (Line-of-Sight):** Veggir og 90 gráðu horn loka sjónlínu 100%.
- **Explored Memory (`EXPLORED_MEMORY`):** Áður kannaðir reitir utan núverandi sjónlínu birtast í dimmri minnisþoku án þess að leka óséðum viðburðum.
- **Algjört myrkur (`#050508`) á ókönnuðum reitum (`UNEXPLORED`):** Eftir að geislalýsing kyndils er teiknuð er `#050508` stimplað aftur yfir alla `UNEXPLORED` reiti þannig að enginn ljósblær lekur nokkurn tímann inn á ókannaða reiti (staðfest með beinni pixlamælingu `cornerHex === '#050508'`).
- **Skerpa og textafrágangur í 1440×900 og 1920×1080:** Allir reitir og merkingar (`drawMapLabel`) nota heiltöluhnit (`Math.round`), árekstrarvörn kemur í veg fyrir að merkingar skarist, og enginn texti klippist í sundur.

---

## 3. Sjálfvirk E2E Prófun (`action-ui-lab/tests/phase10-dungeon-e2e.test.js`)

Nýja E2E prófið keyrir **án þess að nota `TELEPORT_TO_TILE`** (bann við `TELEPORT_TO_TILE` er enforced með `assert.notEqual(action, 'TELEPORT_TO_TILE')` í öllum API köllum):

1. **Ranger Sýnileikageisli 3 & Gönguferð:**
   - Stofnar Ranger (`SylvaShadowstep`) í Oakhaven `[15, 27]`, gengur skref fyrir skref (`TURN` + `MOVE`) eftir slóðinni í Goblin Cave `[9, 12]`, fer inn í dýflissuna og staðfestir `visionRadius === 3` og að reitur `(3, 13)` í 3 reita fjarlægð sé `VISIBLE`.
2. **Full Cleric Herferð í gegnum báðar dýflissur:**
   - Stofnar Cleric (`AldricLightbringer`) í Oakhaven `[15, 27]`, tekur við verkefninu `THE_ANCIENT_CRYPT`.
   - Gengur skref fyrir skref í Goblin Cave `[9, 12]` og fer inn á `[3, 16]`.
   - Staðfestir `visionRadius === 2`, veggjaárekstrarvörn (`MOVE SOUTH` á `[3, 17]`), `EXPLORED_MEMORY` þoku og að `UNEXPLORED` reitir leki engum upplýsingum.
   - Kannar kistur (`[1, 15]`, `[1, 8]`, `[18, 15]`), helgidóm (`[2, 2]`), og gildrur (`[2, 14]`).
   - Prófar alla bardagamöguleika:
     - **Attack** (`ATTACK`)
     - **Use Potion** í bardaga (`POTION`) og utan bardaga (`USE_CONSUMABLE`)
     - **Flee** (`FLEE`): Staðfestir bæði að flótti sé læstur í umferðum 1–2 í fyrirsát (`CAVE_SPIDER_BROOD` á `[2, 9]`) OG að flótti takist í venjulegum bardaga (`CAVE_WARCAMP_SENTRY` á `[14, 12]`).
     - **Class Abilities:** `SMITE`, `BATTLE_PRAYER`, `DIVINE_SHIELD` í bardaga og `CLERIC_HEAL` utan bardaga.
   - Gengur á Boss-helgidóminn `[16, 2]`, sigrar **Skulkrip the Cave Brood-King**, gengur til baka á útgangsstigann `[3, 16]` og fer út (`EXIT_DUNGEON`).
   - Gengur skref fyrir skref aftur til Oakhaven `[15, 27]` og þaðan eftir Sepulcher Road alla leið í **The Ancient Crypt** `[26, 5]`.
   - Fer inn í Ancient Crypt (`[10, 17]`), kannar grafhvelfingar, kistur (`[1, 17]`, `[18, 17]`, `[17, 2]`), helgidóm (`[2, 2]`), og bölvaðar gildrur (`[15, 14]`, `[7, 7]`).
   - Gengur á Boss-helgidóminn `[10, 2]`, sigrar **Lord Malakor the Barrow-Wight King**, gengur til baka á `[10, 17]`, fer út (`EXIT_DUNGEON`), gengur skref fyrir skref aftur til Oakhaven `[15, 27]` og innleysir verðlaunin (`CLAIM_QUEST_REWARD` fyrir `THE_ANCIENT_CRYPT`).

**Niðurstaða keyrslu:**
```text
✔ 1. Ranger Vision Radius 3 & Opening Shot inside Goblin Cave (walked step-by-step from Oakhaven)
✔ 2. Full Cleric Campaign: Walk to Goblin Cave, LoS & Fog of War, Traps, Chests, Flee/Potion/Abilities, Skulkrip Boss, then Walk to Ancient Crypt & Slay Lord Malakor
ℹ tests 2 | pass 2 | fail 0
```

---

## 4. Sjónræn Gæðaprófun í Headless Chrome (`action-ui-lab/tests/phase10-dungeon-visual-qa.js`)

Keyrt var sjálfvirkt Headless Chrome próf sem gengur skref fyrir skref (án `TELEPORT_TO_TILE`) í gegnum báðar dýflissur og tekur **20 skjáskot** (10 lykilatburðir × 2 upplausnir: **1440×900** og **1920×1080**) í `docs/phase-10/screenshots/`:

| Nr. | Skjáskot (`1440x900` & `1920x1080`) | Lýsing og sannreynir |
| :--- | :--- | :--- |
| **01** | `dungeon-01-goblin-cave-entrance-*.png` | Inngangssenan við The Goblin Cave `[9, 12]` eftir gönguferð frá Oakhaven. |
| **02** | `dungeon-02-goblin-cave-start-los-*.png` | Byrjunarreitur `[3, 16]` í Goblin Cave: steinstigi, kyndilskin, beinagildra, kista, blágrænir sveppir og `#050508` myrkur. |
| **03** | `dungeon-03-goblin-cave-corridors-and-props-*.png` | Kannaðir gangar í Goblin Cave (`[3, 9]` Spider-Silk Hollow): `VISIBLE`, `EXPLORED_MEMORY`, kóngulóarvefur, varðstöð og fjársjóðskista. |
| **04** | `dungeon-04-goblin-cave-boss-sanctum-*.png` | Brood-King Sanctum `[16, 2]`: blóðrúnahringur, eldstór, kórónutákn og áskorunarkort Skulkrip. |
| **05** | `dungeon-05-goblin-cave-boss-combat-*.png` | Bardagaviðmót gegn **Skulkrip the Cave Brood-King** í Goblin Cave. |
| **06** | `dungeon-06-ancient-crypt-entrance-*.png` | Inngangssenan við The Ancient Crypt `[26, 5]` eftir gönguferð eftir Sepulcher Road. |
| **07** | `dungeon-07-ancient-crypt-start-los-*.png` | Byrjunarreitur `[10, 17]` í Ancient Crypt: kaldar marmarahellur, purpuradregill, gotneskar grafhvelfingar og `#050508` myrkur. |
| **08** | `dungeon-08-ancient-crypt-halls-and-sarcophagi-*.png` | Kannaðir salir í Ancient Crypt (`[7, 7]` Sepulcher Corridor): bláglóandi rúnasteinar á veggjum, grafhvelfingar og `EXPLORED_MEMORY`. |
| **09** | `dungeon-09-ancient-crypt-boss-sanctum-*.png` | Royal Sepulcher `[10, 2]`: smaragðsgrænn rúnahringur og áskorunarkort Lord Malakor. |
| **10** | `dungeon-10-ancient-crypt-boss-combat-*.png` | Bardagaviðmót gegn **Lord Malakor the Barrow-Wight King** í Ancient Crypt. |

**Sjálfvirkar mælingar í `phase10-dungeon-visual-qa.js`:**
- `cornerHex === '#050508'` staðfest á ókönnuðum svæðum í báðum dýflissum.
- `clippedElements.length === 0` staðfest í bæði `1440×900` og `1920×1080`.
- `consoleErrors.length === 0` og `pageExceptions.length === 0`.
