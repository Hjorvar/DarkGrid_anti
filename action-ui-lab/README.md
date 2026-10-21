# Darkgrid — Action Viewport Prototype (`action-ui-lab/`)

Þessi mappa geymir sjálfstæða **First-Person Action Viewport** tilraunaútgáfu (innblásna af *Dungeon Master* og *Legend of Grimrock*), hannaða í samræmi við opinbera stílleiðbeiningu Darkgrid (`docs/game-ui-style.md`).

Tilraunaútgáfan er 100% sjálfstæð innan `action-ui-lab/`. Hún notar sinn eigin einangraða SQLite gagnagrunn (`action-ui-lab/data/action_lab.sqlite`) og hefur engin áhrif á skrár, gagnagrunn eða þjónustur aðalleiksins.

## Keyrsla og prófanir

```bash
# Ræsa Action Viewport tilraunaþjóninn á http://localhost:3030
node action-ui-lab/server.js

# Keyra sjálfvirku prófunarsvíturnar fyrir tilraunaútgáfuna (59/59 próf)
node --test action-ui-lab/tests/action-lab.test.js action-ui-lab/tests/world-travel.test.js action-ui-lab/tests/player-ui.test.js
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

## Framkvæmda- og samanburðarskýrslur
Ítarlegar skýrslur ásamt skjáskotum eru í:
- **Phase 2 (World Exploration, Encounter Pacing & Visual Continuity):**
  - [`action-ui-lab/docs/implementation/phase-2/PHASE-2-IMPLEMENTATION-REPORT.md`](docs/implementation/phase-2/PHASE-2-IMPLEMENTATION-REPORT.md)
  - [`action-ui-lab/docs/implementation/phase-2/PHASE-2-ENCOUNTER-ANALYSIS.md`](docs/implementation/phase-2/PHASE-2-ENCOUNTER-ANALYSIS.md)
  - [`action-ui-lab/docs/implementation/phase-2/PHASE-2-VISUAL-QA.md`](docs/implementation/phase-2/PHASE-2-VISUAL-QA.md)
  - [`action-ui-lab/docs/implementation/phase-2/PHASE-2-ART-BACKLOG.md`](docs/implementation/phase-2/PHASE-2-ART-BACKLOG.md)
  - [`action-ui-lab/docs/implementation/phase-2/PHASE-2-FOLLOWUP.md`](docs/implementation/phase-2/PHASE-2-FOLLOWUP.md)
- **Phase 1 (World Continuity & Scene Resolver Repair):**
  - [`action-ui-lab/docs/implementation/phase-1/PHASE-1-IMPLEMENTATION-REPORT.md`](docs/implementation/phase-1/PHASE-1-IMPLEMENTATION-REPORT.md)
  - [`action-ui-lab/docs/implementation/phase-1/PHASE-1-VISUAL-QA.md`](docs/implementation/phase-1/PHASE-1-VISUAL-QA.md)
  - [`action-ui-lab/docs/implementation/phase-1/PHASE-1-FOLLOWUP.md`](docs/implementation/phase-1/PHASE-1-FOLLOWUP.md)
- [`action-ui-lab/docs/viewport-visual-redesign-report.md`](docs/viewport-visual-redesign-report.md) — Endurhönnun myndbirtingar og sjónarhorns.
- [`action-ui-lab/docs/action-viewport-implementation-report.md`](docs/action-viewport-implementation-report.md) — Upprunaleg framkvæmdaskýrsla fyrir First-Person Action Viewport.
