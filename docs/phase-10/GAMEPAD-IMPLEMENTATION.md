# Phase 10 — Gamepad API Stuðningur (Xbox & Lenovo Legion Go 2)

Þetta skjal lýsir hönnun, útfærslu og prófunum á fullum **W3C Gamepad API** stuðningi í `action-ui-lab/public/` fyrir **DarkGrid**, með sérstakri áherslu á **Xbox stýringar (XInput)** og **Lenovo Legion Go 2 (TrueStrike innbyggðar handtölvustýringar)**.

---

## 1. Yfirlit og Arkitektúr

Gamepad kerfið er einangrað í hreinni ES einingu (`gamepad.js`) sem vinnur samhliða lyklaborðs- og músarstýringum án þess að raska núverandi viðburðakeðju eða reglum á þjóni (server-side truth):

- **`action-ui-lab/public/js/ui/gamepad.js` (NÝ SKRÁ)**:
  - Rekur `requestAnimationFrame` könnunarlykkju (`stepGamepadFrame`) sem les `navigator.getGamepads()`.
  - Greinir sjálfkrafa tegund stýringar (`identifyControllerProfile`) fyrir **Lenovo Legion Go 2**, **Xbox Controller** og almennar **W3C Standard Gamepad** stýringar.
  - Sameinar inntak ef handtölva (t.d. Lenovo Legion Go 2 í detached/dual DirectInput/XInput ham) birtist sem tvær stýrieiningar í `navigator.getGamepads()`.
  - Stýrir sjónrænum fókus (`.gamepad-focus`) í öllum leikhamum (Yfirheimi, Dýflissum, Stage 1 og Stage 2 bardaga, og öllum gluggum/modals).
  - Býður upp á innbyggð prófunarhjálparföll (`createMockGamepad`, `setMockGamepadState`, `simulateGamepadButtonPress`, `simulateGamepadDirection`, `stepGamepadFrame`, `getGamepadDebugState`) fyrir sjálfvirk E2E vafrapróf.
- **`action-ui-lab/public/js/ui/shortcuts.js` (UPPFÆRÐ)**:
  - Flytur inn `initGamepad` úr `./gamepad.js` og ræsir Gamepad vélina sjálfkrafa þegar `setupKeyboardShortcuts()` (eða `initShortcuts()`) er kallað í ræsingu (`app.js`).
- **`action-ui-lab/public/css/components.css` (UPPFÆRÐ)**:
  - Skilgreinir `.gamepad-focus` (gullinn upplýstur rammi með mjúkri пульs-hreyfingu) og `.gamepad-status-pill` (stöðumerki í efri stjórnstiku sem sýnir virka stýringu).
- **`action-ui-lab/tests/phase10-gamepad.test.js` (NÝ SKRÁ)**:
  - Fullkomin Node.js + Headless Chrome/Edge (CDP) prófunarsvíta (7 próf) sem sannreynir alla virkni enda-til-enda.

---

## 2. Stýringarsnið og HUD Stöðumerki (`.gamepad-status-pill`)

Þegar stýring tengist (`gamepadconnected` viðburður eða virkni á hnöppum/ásum í `navigator.getGamepads()`) birtist stöðumerki (`#gamepad-status-pill.gamepad-status-pill`) í efri stjórnstiku (`#lab-director-bar`). Texti í viðmóti fylgir 100% enskri tungumálastefnu leiksins:

| Greind stýring (`Gamepad.id`) | Snið (`profileKey`) | HUD Texti (English UI) | CSS Flokkur |
| :--- | :--- | :--- | :--- |
| `Lenovo`, `Legion`, `TrueStrike` | `LEGION_GO` | `🎮 Legion Go Controller` | `.is-legion-go` |
| `Xbox`, `XInput`, `Microsoft` | `XBOX` | `🎮 Xbox Controller` | `.is-xbox` |
| Aðrar W3C samhæfðar stýringar | `STANDARD` | `🎮 Gamepad Ready` | `.is-standard` |

Ef stýring aftengist (`gamepaddisconnected`) og engin önnur stýring er tengd, hverfur merkið og `.gamepad-focus` er hreinsað.

---

## 3. Hnappa- og Ásayfirlit (W3C Standard Mapping)

| Hnappur / Ás | W3C Vísi (`buttons` / `axes`) | Yfirheimur & Dýflissur (Exploration) | Bardagi Stage 1 (Encounter Secrecy) | Bardagi Stage 2 (Active Combat) | Gluggar & Valmyndir (Modals) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **D-Pad Up / Down / Left / Right** | `buttons[12..15]` | Hreyfing (`NORTH`, `SOUTH`, `WEST`, `EAST`) | Færa `.gamepad-focus` milli *Fight* og *Avoid* | Færa `.gamepad-focus` milli bardagahnappa | Færa `.gamepad-focus` milli hnappa/flipa í glugga |
| **Left Stick (L-Stick)** | `axes[0]`, `axes[1]` | Hreyfing (`NORTH`, `SOUTH`, `WEST`, `EAST`, deadzone `0.45`) | Færa `.gamepad-focus` | Færa `.gamepad-focus` | Færa `.gamepad-focus` í glugga |
| **Right Stick (R-Stick)** | `axes[2]`, `axes[3]` | Færa `.gamepad-focus` á HUD hnöppum | Færa `.gamepad-focus` | Færa `.gamepad-focus` | Skruna innihald glugga (`#lab-modal-body`) |
| **A (Cross / Bottom)** | `buttons[0]` | Virkja valinn hnapp / Ganga inn í dýflissu / Opna borg / Stiga út úr dýflissu | **Engage / Fight** (hefja bardaga, nema ef fókus er á *Avoid*) | **Attack** (beitt vopnsárás) eða virkja valinn `.gamepad-focus` hnapp | **Confirm / Select** (t.d. *Equip*, *Use*, *Buy*, *Sell*, *+1 Attribute*, *Accept Quest*) |
| **B (Circle / Right)** | `buttons[1]` | Loka Landmark senu / Loka POI spjaldi / Loka Discovery | **Avoid / Evade** (flýja óþekkta ógn ef ekki *Ambush*) | **Flee Combat** (flýja bardaga ef ekki *Ambush*) | **Cancel / Back** (loka virkum glugga) |
| **X (Square / Left)** | `buttons[2]` | Cleric *Divine Heal* (ef særður) / Skoða POI / Opna *Quests* | **Avoid / Evade** (flýja óþekkta ógn) | **Class Ability** (Cleric *Battle Prayer* / *Smite* / *Divine Shield*) eða árás | Skipta um flipa í *Quests* (`QUESTS` ↔ `BOUNTIES`) eða *Market* (`BUY` ↔ `RESALE` ↔ `SELL`) |
| **Y (Triangle / Top)** | `buttons[3]` | Drekka *Healing Potion* (ef særður) eða opna *Inventory / Backpack* | Virkja valinn hnapp | **Drink Healing Potion** (`POTION`) | Sía vöruflokka í *Market* eða opna/loka *Backpack* |
| **LB (Left Bumper)** | `buttons[4]` | **Swap Weapon Stance** (Melee ↔ Ranged) | Færa fókus til vinstri | **Swap Weapon Stance** (Melee ↔ Ranged) | Fletta í fyrri glugga (*Hero* ← *Backpack* ← *Market* ← *Quests* ← *Map* ← *Journal* ← *Help*) |
| **RB (Right Bumper)** | `buttons[5]` | **Swap Weapon Stance** (Melee ↔ Ranged) | Færa fókus til hægri | **Swap Weapon Stance** (Melee ↔ Ranged) | Fletta í næsta glugga (*Hero* → *Backpack* → *Market* → *Quests* → *Map* → *Journal* → *Help*) |
| **LT (Left Trigger)** | `buttons[6]` | Opna/loka *Quests & Bounties* | — | — | Fletta í fyrri glugga |
| **RT (Right Trigger)** | `buttons[7]` | Opna/loka *Backpack / Inventory* | — | — | Fletta í næsta glugga |
| **View / Back / Select** | `buttons[8]` | Opna/loka **Region Map** (`[M]`) | — | — | Opna/loka **Region Map** (`[M]`) |
| **Menu / Start** | `buttons[9]` | Opna/loka **Hero Sheet** (`[C]`) | — | — | Opna/loka **Hero Sheet** (`[C]`) |
| **L3 (Left Stick Click)** | `buttons[10]` | Opna/loka **Quests & Bounties** (`[Q]`) | — | — | Opna/loka **Quests & Bounties** (`[Q]`) |
| **R3 (Right Stick Click)** | `buttons[11]` | Opna **Oakhaven Market** (í borg) eða **Help** (`[?]`) | — | — | Opna **Market** / **Help** |

---

## 4. Deadzone, Repeat/Debounce og `store.isBusy` Vörn

Til að tryggja mjúka og nákvæma stjórnun á bæði Lenovo Legion Go 2 Hall-effect pinnum og Xbox stýringum:

1. **Radial & Axis Deadzone (`0.45`)**:
   - Smávægilegt rek á pinna (`|axis| < 0.45`) er hunsað algjörlega svo hetjan reki aldrei óviljandi af stað.
   - Ef bæði D-Pad og vinstri pinni eru hreyfðir samtímis hefur D-Pad forgang fyrir hnitmiðaða flísahreyfingu.
2. **Tafarlaus fyrsta hreyfing + `195ms` Repeat Delay**:
   - Um leið og ýtt er á D-Pad eða pinna í nýja átt (`isNewDirection`) er fyrsta skrefið sent samstundis.
   - Ef stefnu er haldið inni gildir `GAMEPAD_CONFIG.REPEAT_DELAY_MS = 195` ms biðtími milli skrefa (innan `180–220ms` viðmiðunar).
   - Ef stefnu er haldið inni í minna en `195ms` (t.d. `80ms`) er engin auka hreyfing send.
3. **Rising-Edge Debounce á Aðgerðahnöppum (`A`, `B`, `X`, `Y`, `LB`, `RB`, `Start`, `View`)**:
   - Allir aðgerðahnappar (`buttons[0..11]`) virkjast eingöngu á *rising edge* (`pressed === true && prevPressed === false`). Hnappur verður að losna áður en hann getur sent aðra aðgerð.
4. **`store.isBusy` Læsing**:
   - Ef netbeiðni (`/api/action`) er í gangi (`store.isBusy === true`) bíður hreyfilykkjan þar til svarið er komið og viðmótið hefur uppfærst áður en næsta skref er leyft.

---

## 5. Sjálfvirk Gæðapróf og Headless Browser QA

Öll virkni var sannreynd með sjálfvirku E2E prófunarsvítunni `action-ui-lab/tests/phase10-gamepad.test.js` sem keyrir raunverulegan Express + SQLite þjón og Headless Chrome/Edge vafra:

```bash
node --test action-ui-lab/tests/phase10-gamepad.test.js
```

### Niðurstöður prófa (7 / 7 Stóðust):
1. **Architecture, Wiring & CSS**: Staðfestir ES-einingatengingu milli `gamepad.js` og `shortcuts.js`, `.gamepad-focus` og `.gamepad-status-pill` í `components.css`, og að enginn íslenskur texti leki í leikmannsviðmót.
2. **Controller Profiles & HUD Status Pill**: Staðfestir greiningu á Lenovo Legion Go 2 (`🎮 Legion Go Controller`), Xbox (`🎮 Xbox Controller`), samruna tvískiptra Legion Go stýringa, og aftengingu.
3. **Overworld Movement, Deadzone (`0.45`) & Repeat/Debounce**: Staðfestir að `< 0.45` hreyfir ekki hetju, fyrsta ýting á D-Pad hreyfir strax, `< 195ms` hald tvítekur ekki skref, `>= 195ms` hald tekur næsta skref mjúklega, og vinstri pinni (`> 0.45`) hreyfir hetju.
4. **Landmarks & Dungeons via Gamepad**: Staðfestir að `B` lokar Landmark senu við Goblin Cave, `A` gengur inn í dýflissuna, vinstri pinni og D-Pad hreyfa hetju um dýflissuna, og `A` við útgöngustiga fer aftur upp á yfirheimskortið.
5. **Combat UI (Stage 1 Secrecy & Stage 2 Active Combat)**: Staðfestir að í Stage 1 flýr `X`/`B` ógn (`AVOID`) og `A` ræðst til atlögu (`FIGHT`). Í Stage 2 byrjar `.gamepad-focus` á `#action-slot-1`, D-Pad færir fókus á `#action-slot-2`, `Y` drekkur heilsublanda, `X` virkjar Cleric *Battle Prayer*, `A` framkvæmir vopnsárás, og `B` flýr bardaga.
6. **Modals, Panels & `.gamepad-focus` Navigation**: Staðfestir að `LB` skiptir um vopnastöðu (Melee ↔ Ranged), `Start` opnar Hero glugga þar sem `A` eyðir `+1` eiginleikastigi, `RB` flettir yfir í Backpack, Oakhaven Market (þar sem `A` kaupir hlut og `X` skiptir um flipa) og Quests (þar sem `A` samþykkir verkefni og `X` skiptir yfir í Bounties), `View` opnar Region Map (`[M]`), og `B` lokar glugganum.
7. **Keyboard & Mouse Coexistence**: Staðfestir að lyklaborðsflýtilyklar (`KeyM`, `Escape`) og músarsmellir virka 100% samhliða Gamepad án nokkurra villna í console.
