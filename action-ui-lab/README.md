# Darkgrid — Action Viewport Prototype (`action-ui-lab/`)

Þessi mappa geymir sjálfstæða **First-Person Action Viewport** tilraunaútgáfu (innblásna af *Dungeon Master* og *Legend of Grimrock*), hannaða í samræmi við opinbera stílleiðbeiningu Darkgrid (`docs/game-ui-style.md`).

Tilraunaútgáfan er 100% sjálfstæð innan `action-ui-lab/`. Hún notar sinn eigin einangraða SQLite gagnagrunn (`action-ui-lab/data/action_lab.sqlite`) og hefur engin áhrif á skrár, gagnagrunn eða þjónustur aðalleiksins.

## Keyrsla og prófanir

```bash
# Ræsa Action Viewport tilraunaþjóninn á http://localhost:3030
node action-ui-lab/server.js

# Keyra sjálfvirku prófunarsvítuna fyrir tilraunaútgáfuna
node --test action-ui-lab/tests/action-lab.test.js
```

Opnaðu í vafra: **http://localhost:3030** (eða sérsniðið port með `ACTION_LAB_PORT`).

## Stýringar (First-Person Navigation & Tactical Deck)

### Sjónstefna og hreyfing
Hetjan hefur sjálfstæða sjónstefnu (`NORTH`, `EAST`, `SOUTH`, `WEST`) sem varðveitist í gagnagrunni við endurhleðslu:
- **`W` / `Up Arrow`**: Ganga áfram miðað við núverandi sjónstefnu (`FORWARD`).
- **`S` / `Down Arrow`**: Bakka um einn reit (`BACKWARD`).
- **`A` / `Left Arrow`**: Snúa 90° til vinstri án þess að skipta um reit (`TURN LEFT`).
- **`D` / `Right Arrow`**: Snúa 90° til hægri án þess að skipta um reit (`TURN RIGHT`).
- **`Q`**: Hliðarskref til vinstri (`STRAFE_LEFT`).
- **`E`**: Hliðarskref til hægri (`STRAFE_RIGHT`).

### Bardagi, ógnir og gluggar
- **`Space` / `1`**: Aðalaðgerð eftir ástandi (*Strike* í bardaga, *Engage Threat* á `DISCOVERED`, *Sanctuary Rest* í Oakhaven). Einnig má smella beint á skugga/skrímsli í glugganum.
- **`2`**: Drekka lækningadrykk (*Drink Potion*).
- **`3` / `R`**: Skipta um vopnastöðu (*Swap Stance* milli Melee og Ranged utan bardaga).
- **`4` / `F`**: *Slip Past* (framhjáganga framhjá ógn á `DISCOVERED`), *Flee Battle* (tvöföld staðfesting í virkum bardaga) eða *Divine Heal* (fyrir Cleric utan bardaga).
- **`C`**: Champion Sheet (*Hero*).
- **`B`**: Equipment & Backpack (*Pack*).
- **`M`**: Oakhaven Market (*Market*).
- **`J`**: The Watcher's Board (*Board*).
- **`Escape`**: Loka opnum glugga.

## Sjónarhorns- og myndbirtingarhamir (Scene Modes)

Í **Lab Director** stikunni efst í viðmótinu er hægt að skipta samstundis á milli þriggja myndbirtingarhama á sömu staðsetningu og í sömu sjónstefnu:

- **`A: Single Scene ★` (Útfærsla A — Staðarbundin heildstæð sena):** Velur eitt heildstætt málverk út frá núverandi reit, landslagsafbrigði (*deterministic variant*) og sérstökum kennileitum (`MARKETPLACE`, `TOWN_GATES`, `ANCIENT_BRIDGE`, `SUNK_RUIN`, `ANCIENT_OAK`). Ef horft er beint á ófæra hindrun (fjallgarð eða á) birtist heildstæð hindrunarmynd. Engin gagnsæisblöndun tveggja málverka og engin bráðabirgða-SVG lög.
- **`B: Directional Scene` (Útfærsla B — Stefnumiarið útsýni fram undan):** Velur eitt heildstætt málverk út frá reitapari (`currentTile -> ahead1`) og sjónstefnu (`NORTH`, `EAST`, `SOUTH`, `WEST`), þannig að útsýnið breytist þegar hetjan snýr sér og sýnir hvert ferðinni er heitið.
- **`Legacy (Blended+SVG)` (Upprunaleg tilraunaútgáfa):** Varðveitir gömlu `ahead-portal` gagnsæisblöndunina og `buildMapConnectedSceneSvg()` línuteikningarnar til hliðarsamanburðar.

Einnig eru flýtihnappar í Lab Director stikunni fyrir **🏰 Town**, **🌲 Forest**, **🌉 Bridge**, **👁️ Stage 1**, **⚔️ Melee**, **🦅 Flying** og **🔄 Reset** (sem hreinsar varanlegar skrímslaleifar og endurstillir prófunarheiminn).

## Framkvæmda- og samanburðarskýrslur
Ítarlegar skýrslur ásamt skjáskotum eru í:
- [`action-ui-lab/docs/viewport-visual-redesign-report.md`](docs/viewport-visual-redesign-report.md) — Endurhönnun myndbirtingar og sjónarhorns (Samanburður á Útfærslu A, Útfærslu B og Legacy).
- [`action-ui-lab/docs/action-viewport-implementation-report.md`](docs/action-viewport-implementation-report.md) — Upprunaleg framkvæmdaskýrsla fyrir First-Person Action Viewport.
