# DARKGRID — INDEPENDENT HIGH REVIEW (`Top-down Exploration Experiment 1`)

**Dagsetning úttektar:** 23. október 2026  
**Worktree / Branch:** `topdown_exploration_experiment_one` (viðmiðunar-tag fyrir breytingar: `pre-topdown-experiment-1` @ `970c6a2`)  
**Staða eftir úttekt og lagfæringar:** **SAMÞYKKT MEÐ SKILYRÐUM (Tæknilega traust eftir lagfæringar á 2 CRITICAL og 5 IMPORTANT atriðum; sjá DESIGN-ákvarðanir í kafla 4)**

---

## 1. Yfirlit yfir hvað var rannsakað og prófað

Framkvæmd var óháð kóðarýni, gagnagrunnsúttekt, sjálfvirk prófakeyrsla og sjónræn Headless Chrome QA-prófun á allri útfærslu *Top-down Exploration Experiment 1*:

1. **Kóðarýni og Git-samanburður (`git diff pre-topdown-experiment-1`):**
   - Nýjar skrár:
     - [`action-ui-lab/server/services/topdown-world-service.js`](action-ui-lab/server/services/topdown-world-service.js) (56-reita `8×7` heimsskilgreining, Goblin Forest encounter-líkindadreifing `80/15/5`, verkefnið *The Goblin Chieftain* og Stronghold Boss).
     - [`action-ui-lab/public/js/world/topdown-renderer.js`](action-ui-lab/public/js/world/topdown-renderer.js) (2D HTML5 Canvas top-down kortateiknari án sýnilegra hnitanetslína).
     - [`action-ui-lab/tests/topdown-experiment.test.js`](action-ui-lab/tests/topdown-experiment.test.js) og [`action-ui-lab/tests/topdown-visual-qa.js`](action-ui-lab/tests/topdown-visual-qa.js).
   - Breyttar skrár í bakenda og framenda:
     - [`navigation-controller.js`](action-ui-lab/server/controllers/navigation-controller.js), [`combat-controller.js`](action-ui-lab/server/controllers/combat-controller.js), [`character-town-controller.js`](action-ui-lab/server/controllers/character-town-controller.js), [`adventure-scenario-controller.js`](action-ui-lab/server/controllers/adventure-scenario-controller.js), [`client-state-service.js`](action-ui-lab/server/services/client-state-service.js), [`sandbox-db-service.js`](action-ui-lab/server/services/sandbox-db-service.js), [`legacy-compatibility-service.js`](action-ui-lab/server/services/legacy-compatibility-service.js), [`index.html`](action-ui-lab/public/index.html), [`world.css`](action-ui-lab/public/css/world.css), [`app.js`](action-ui-lab/public/js/app.js), [`navigation.js`](action-ui-lab/public/js/world/navigation.js), [`scene-renderer.js`](action-ui-lab/public/js/world/scene-renderer.js), [`combat-ui.js`](action-ui-lab/public/js/combat/combat-ui.js), [`modals.js`](action-ui-lab/public/js/ui/modals.js) og [`shortcuts.js`](action-ui-lab/public/js/ui/shortcuts.js).
   - Staðfest að **`src/domain/` var 100% ósnert** (`git diff src/` skilar engum breytingum).
2. **Sjálfvirk próf og sjónræn prófun:**
   - **Kjarnapróf (`npm test`):** **244 / 244 próf standast** (0 villur).
   - **Top-Down Experiment próf (`node --test action-ui-lab/tests/topdown-experiment.test.js`):** **9 / 9 próf standast** (aukið úr 8 í 9 próf við úttektina til að festa lagfæringar í sessi).
   - **Headless Chrome Visual QA (`node action-ui-lab/tests/topdown-visual-qa.js`):** **5 / 5 skjáskot og DOM/Canvas mælingar standast** á `1440×900` með 0 console/page errors.

---

## 2. Niðurstöður eftir 7 skoðunarliðum

| # | Skoðunarliður | Mat | Helstu niðurstöður |
|---|---|---|---|
| **1** | **Phase 7C leikjakerfi óbreytt** | **TRAUST** | Eng engin breyting var gerð á `src/domain/`. 72-punkta hetjusmiðja, Fighter (*Second Wind*), Ranger (*Favored Enemy* og *Opening Shot*), Cleric (*Divine Charges*, *Battle Prayer*, *Smite*, *Divine Shield*, *Holy Radiance*), verslun, birgðir, vopnastöður og brynja virka óbreytt. |
| **2** | **Endurnýting á Darkgrid game logic** | **TRAUST** | Top-down kerfið kallar beint á `executeCombatRound`, `investigateEncounter`, `ignoreEncounter`, `getVictoryData`, `recordPlayerDeath`, `calculateXpWithIntelligence` og `applyCharacterLevelUp` úr `src/domain/`. |
| **3** | **Movement, encounters, combat, boss, quests, permadeath** | **LAGAÐ** | Hreyfing (1 skref = 1 reitur í höfuðáttir), `80/15/5` Goblin Forest encounter-dreifing, pacing-vernd (ekkert encounter-spam á hverju skrefi), verkefnið *The Goblin Chieftain* (þ.m.t. ef boss er drepinn áður en verkefni er þegið) og Permadeath/Nemesis virka rétt. Tvær alvarlegar villur í kortateikningu og boss-transition voru fundnar og lagaðar (sjá kafla 3). |
| **4** | **Gagnagrunnur og leikjastaða (transactional safety)** | **LAGAÐ** | Allar stöðubreytingar nota `withTransaction(db, ...)`, anti-tamper og idempotency middleware. Fundin var glufa í `startStrongholdBossEncounter` þar sem hægt var að endurræsa/flýja virkan bardaga án AoO, ásamt jaðartilfelli við nýja hetju eftir permadeath; hvort tveggja var lagað. |
| **5** | **Einfaldleiki, viðhaldsvæni og stækkunarhæfni** | **ÞARF ÁKVÖRÐUN** | Kóðinn í `topdown-world-service.js` og `topdown-renderer.js` er skýr fyrir eitt `8×7` svæði, en geymir staðbundið kort í minni (`TOPDOWN_TILES` fylki) og verkefnisstöðu í tveimur sérhæfðum dálkum á `characters` töflunni (`quest_goblin_chieftain_status`, `goblin_chieftain_slain`). Fyrir miklu stærri heim þarf gagnadrifna töflu/töflur (sjá `DESIGN` í kafla 4). |
| **6** | **UI og Darkgrid-þema** | **LAGAÐ** | Top-down kortið tekur ~82% af vinnusvæðinu, án hnitanetslína, með samræmdu dark-fantasy litaþema. Lagaðar voru sjónrænar skarist-villur (merki Oakhaven ofan í neðri bæjarstiku, faldur *Challenge Chieftain* hnappur í hægri dálki við `[7,1]`, og 4-lína textabrot á nafni boss í bardaga). |
| **7** | **Tvíverknaður, tímabundnar lausnir og hardcoded reglur** | **LAGAÐ / DESIGN** | Fjarlægð voru hardcoded `[7, 1]` hnit í framenda (`navigation.js`, `combat-ui.js`, `scene-renderer.js`) og hardcoded vegalínur/rústir í `topdown-renderer.js` sem stönguðust á við bakendann. Eftir standa hönnunarákvarðanir um hvernig 15×15 (eða stærri) heimur og eldri Mode A/B/C próf eiga að lifa saman. |

---

## 3. Flokkun athugasemda og framkvæmdar lagfæringar

### 🔴 CRITICAL — Varð að laga (LAGAÐ OG ENDURPRÓFAÐ)

#### CRITICAL-1: Ósamræmi milli bakendakorts og Canvas-kortateiknara (ósýnilegir veggir á vegum og ám)
- **Vandamál:** Í [`topdown-world-service.js`](action-ui-lab/server/services/topdown-world-service.js) eru reitir `[9, 4]` (*Blackwater Ravine*) og `[9, 5]` (*Blackwater Rapids*) ófærir árreitir (`RIVER_LAKE`, `is_passable: 0`), en fær austurleið liggur um `[9, 7] -> [9, 6] -> [10, 6] -> [10, 5] -> [10, 4] -> [10, 3] -> [9, 3] (Old Log Crossing) -> [8, 3]`. Hins vegar teiknaði [`topdown-renderer.js`](action-ui-lab/public/js/world/topdown-renderer.js) brúna göngustíga og steinrústir beint yfir ófæru árreitina `[9, 5]` og `[9, 4]`, sleppti timburbrúnni á `[9, 3]`, og teiknaði árfarveginn aðeins á `x = 8`. Leikmaður sem fylgdi sýnilegum vegi á kortinu rakst því á ósýnilegan vegg (*"Path blocked: Blackwater Rapids is impassable"*).
- **Lagfæring:**
  - Uppfærði [`topdown-renderer.js`](action-ui-lab/public/js/world/topdown-renderer.js) þannig að *Blackwater River* rennur samfellt eftir réttum farvegi: `[9, 3]` (undir *Old Log Crossing* timburbrú) $\rightarrow$ `[9, 4]` $\rightarrow$ `[9, 5]` $\rightarrow$ `[8, 6]` $\rightarrow$ `[8, 7]` (undir *The Old Stone Bridge*), með sýnilegum flúðum og steinum á ófæru árreitunum `[9, 4]`, `[9, 5]` og `[8, 6]`.
  - Leiðrétti allar göngustígalínur (`trailSegments`) þannig að þær fylgja eingöngu færum reitum og bætti við keyrslutímavörn sem síar út ófæra reiti út frá `mapData.tiles`.
  - Gerði teikningu rústa (`WATCHPOST` / `RUINS`) gagnadrifna út frá `mapData.tiles` (`[9, 7]`, `[10, 4]`, `[10, 3]`).

#### CRITICAL-2: `ENGAGE_STRONGHOLD_BOSS` leyfði ókeypis flótta/endurræsingu úr virkum bardaga og vantaði `combatSequence`
- **Vandamál:**
  1. `startStrongholdBossEncounter` í [`topdown-world-service.js`](action-ui-lab/server/services/topdown-world-service.js) keyrði `UPDATE encounters SET status = 'ESCAPED' WHERE character_id = ? AND status IN ('DISCOVERED', 'IN_COMBAT')` án þess að athuga hvort leikmaður væri þegar í virkum bardaga (`IN_COMBAT`). Leikmaður í bardaga á `[7, 1]` gat því sent `ENGAGE_STRONGHOLD_BOSS` til að núllstilla bardagann án *Attack of Opportunity* (eða til að virkja *Ranger Opening Shot* aftur og aftur).
  2. Í [`combat-controller.js`](action-ui-lab/server/controllers/combat-controller.js) vantaði `nextState.combatSequence = buildCombatSequence(...)` á `ENGAGE_STRONGHOLD_BOSS`, og sigurskilyrði við upphafsskoti (*Opening Shot*) skoðaði `getActiveEncounterForCharacter` sem skilar `null` þegar staða er orðin `VICTORY`.
- **Lagfæring:**
  - `startStrongholdBossEncounter` hafnar nú kallinu með villu ef hetjan er þegar í `IN_COMBAT`.
  - Ef `investigateEncounter` klárar bardagann strax (`VICTORY`), er `markStrongholdBossSlain` og `pending_victory_encounter_id` uppfært innan sömu færslu (`withTransaction`).
  - `combat-controller.js` hengir nú `buildCombatSequence` við `ENGAGE_STRONGHOLD_BOSS` svo upphafsatburðir bardaga (*Battle Joined!*, *Initiative*, *Opening Shot*) birtast rétt.

---

### 🟠 IMPORTANT — Ætti að laga áður en heimurinn er stækkaður (LAGAÐ OG ENDURPRÓFAÐ)

#### IMPORTANT-1: Aðalhnappurinn `Challenge Chieftain` í hægri aðgerðadálki var falinn á `[7, 1]` og `Move North` notaði ranga áttavísun
- **Vandamál:** Í [`navigation.js`](action-ui-lab/public/js/world/navigation.js) vantaði `&& !isAtStrongholdGate` í `slot1IsIdleFiller`, sem olli því að `slot1` fékk `.is-contextual-inactive` (`display: none`) þegar staðið var við hlið Goblin Stronghold `[7, 1]`. Einnig notaði `#pad-forward` (`Move North`) `relMoves.FORWARD` (miðað við `facing`) í stað `checkCardinalOpen('NORTH').open`.
- **Lagfæring:** Bætti `!isAtStrongholdGate` við `slot1IsIdleFiller`, notaði `checkCardinalOpen('NORTH').open` fyrir `#pad-forward`, og las Stronghold-stöðu úr `state.topdownMap.atStronghold` / `strongholdCoord` í [`navigation.js`](action-ui-lab/public/js/world/navigation.js), [`combat-ui.js`](action-ui-lab/public/js/combat/combat-ui.js) og [`scene-renderer.js`](action-ui-lab/public/js/world/scene-renderer.js).

#### IMPORTANT-2: `currentFacing` í stað `effectiveFacing` eftir höfuðáttahreyfingu í `navigation-controller.js`
- **Vandamál:** Í [`navigation-controller.js`](action-ui-lab/server/controllers/navigation-controller.js) var `effectiveFacing` vistað í gagnagrunn við `MOVE`, en eldra `currentFacing` var sent í `getRelativeCardinalMap`, `onPlayerStep` og `fxCue.facing`.
- **Lagfæring:** `effectiveFacing` er nú notað á öllum þremur stöðum.

#### IMPORTANT-3: Sjónræn skörun í Oakhaven (`OAKHAVEN` merki ofan í bæjarstiku) og í Boss-bardaga (4-lína titill og klipptur texti)
- **Vandamál:**
  1. Í `1-town-oakhaven.png` skaraðist neðri bæjarstikan (`topdown-town-bar`) við `OAKHAVEN` merkið á Canvas-kortinu.
  2. Í `4-combat-goblin-chieftain.png` þrengdist titillinn `WARCHIEF GRAK THE GOBLIN CHIEFTAIN` í 4 línur við hlið 3 merkja í `.fp-monster-title-row`, sem ýtti bardagaspjaldinu upp og klippti neðri línu `#fp-bottom-chronicle`.
- **Lagfæring:**
  - Hækkaði `padBottom` í [`topdown-renderer.js`](action-ui-lab/public/js/world/topdown-renderer.js) svo `OAKHAVEN` og `STONE BRIDGE` merkin sitja hreint fyrir ofan bæjarstikuna.
  - Bætti við `flex-wrap: wrap` á `.fp-monster-title-row` og stækkaði `.fp-monster-hud-plate` í `max-width: 620px` í [`world.css`](action-ui-lab/public/css/world.css).

#### IMPORTANT-4: Ný hetja eftir Permadeath og vernd á Stronghold Boss í Lab-sviðsmyndum
- **Vandamál:**
  1. Ef Hetja 1 sigraði Goblin Chieftain (`monster_instances.status = 'DEFEATED'`) og féll síðar í skóginum, þá erfði nýstofnuð Hetja 2 (`CREATE_CHARACTER` / `REVIVE`) strax `bossSlain = true` í gegnum `syncCharacterQuestState` án þess að hafa nokkurn tíma farið í skóginn.
  2. `LAB_SCENARIO` (`STAGE2_COMBAT`) gat óvart merkt Stronghold Boss sem `DEFEATED` ef sviðsmyndin var keyrð á `[7, 1]`.
- **Lagfæring:**
  - Bætti við `ensureStrongholdBossInstance(db, { respawnIfDefeated: true })` við stofnun nýrrar hetju í [`sandbox-db-service.js`](action-ui-lab/server/services/sandbox-db-service.js) og [`auth-character-controller.js`](action-ui-lab/server/controllers/auth-character-controller.js): ef fyrri hetja hafði þegar drepið bossinn (`DEFEATED`), fær ný hetja ferskan `ACTIVE` boss; en ef bossinn drap fyrri hetjuna (er enn `ACTIVE` sem Nemesis með +10% HP og herfang hinnar föllnu hetju), helst hann óbreyttur svo nýja hetjan geti hefnt!
  - Undanskildi `STRONGHOLD_BOSS_PROFILE.customTitle` þegar `LAB_SCENARIO` hreinsar tilfallandi skrímsli á reit í [`adventure-scenario-controller.js`](action-ui-lab/server/controllers/adventure-scenario-controller.js).

#### IMPORTANT-5: Óæskilegar breytingar á 32 eldri QA-skjáskotum og óþarfa yfirskrift á ytri reitum í `sandbox-db-service.js`
- **Vandamál:** 32 eldri skjáskot í `action-ui-lab/docs/phase-6/` og `overnight-qa/` höfðu orðið óhrein í Git working tree, og `applyTopdownExperimentWorld` vantaði `(8, 8)` `Blackwater River` uppfærsluna og slökkti á `is_passable` á öllum 169 reitum utan `8×7` svæðisins þótt `navigation-controller.js` og `client-state-service.js` loki þegar `8×7` mörkunum með `isCoordInTopdownRegion`.
- **Lagfæring:** Endurheimti öll 32 eldri viðmiðunarskjáskot með `git checkout`, bætti `(8, 8)` `Blackwater River` inn í `applyTopdownExperimentWorld`, og virkjaði `preserveOuterPassability: true` í `sandbox-db-service.js` án þess að veikja `8×7` landamæravörnina í Top-Down upplifuninni.

---

### 🟡 MINOR — Má bíða

1. **Tvöfaldur lyklasamningur í `claimGoblinChieftainReward` (`rewardXp` / `xpAwarded` og `rewardGold` / `goldAwarded`):**
   - `claimGoblinChieftainReward` í [`topdown-world-service.js`](action-ui-lab/server/services/topdown-world-service.js) skilar bæði `xpAwarded`/`goldAwarded` og `rewardXp`/`rewardGold`. Þetta er skaðlaust núna en má samræma í eitt nafnasett þegar almennt Quest-kerfi verður smíðað.
2. **Stöðutexti á `character.secondWindStatus` o.fl. í Top-Down HUD:**
   - Í einfaldaða Top-Down exploration-viðmótinu eru flestir aukakubbar faldir með CSS (`.dev-mode-collapsed`) þar til í bardaga eða í Hero/Inventory glugga (`[C]` / `[B]`). Hægt væri að bæta við litlum vísbendingarhnappi á top-bar ef leikmaður á óúthlutaða eiginleikapunkta (*Unspent Attribute Points*) eftir level-up.

---

## 4. 🔵 DESIGN — Atriði sem eigandi þarf að ákveða áður en heimurinn er stækkaður

Áður en farið er í **Top-Down Exploration Experiment 2** eða stækkun heimsins þarf eigandi að taka ákvörðun um eftirfarandi 4 hönnunaratriði:

### DESIGN-1: Gagnagrunnshönnun fyrir Quests og World Bosses (úr `characters` dálkum í almennar töflur)
- **Núverandi staða:** Verkefnið *The Goblin Chieftain* notar tvo sérhæfða dálka á `characters` töflunni (`quest_goblin_chieftain_status`, `goblin_chieftain_slain`) sem bætt er við í runtime, og bossinn er auðkenndur með `custom_title = 'Warchief Grak the Goblin Chieftain'` í `monster_instances`.
- **Spurning til eiganda:** Viljum við fyrir næsta áfanga búa til almenna `quests` og `character_quests` töflu í `db/migrations/` (líkt og `bounty_contracts`) svo hægt sé að bæta við tugum verkefna og mörgum foringjabúðum (strongholds/dungeons) án nýrra dálka á `characters`?

### DESIGN-2: Stækkun kortsins úr `8×7` (56 reitum) í stærri heim (Camera Viewport / Scrolling / Fog of War)
- **Núverandi staða:** [`topdown-renderer.js`](action-ui-lab/public/js/world/topdown-renderer.js) reiknar `tileSize` þannig að allt `8×7` svæðið rúmist í einu lagi á Canvas-skjánum, ogAllir 56 reitir eru sýnilegir frá byrjun (ekkert *Fog of War*).
- **Spurning til eiganda:** Þegar heimurinn stækkar (t.d. í `15×15` = 225 reiti eða `30×30`), á Canvas-myndavélin að fylgja hetjunni með mjúkri skrunun (*camera viewport centered on hero*, t.d. `9×7` eða `11×9` sýnilegir reitir í einu), og á að vera *Fog of War* (óskoðaðir reitir í myrkri eða minnkaðri birtu þar til hetjan nálgast þá)?

### DESIGN-3: Gagnadrifin kortaskilgreining í SQLite (`map_tiles`) vs. `topdown-world-service.js`
- **Núverandi staða:** `topdown-world-service.js` yfirskrifar `8×7` svæðið í `map_tiles` við ræsingu úr JS-fylki (`TOPDOWN_TILES`) og geymir `visualKind` og `pathConnections` í minni.
- **Spurning til eiganda:** Á að færa `visual_kind` og `path_connections` (eða vegatengsl) beint inn í `map_tiles` í `db/migrations/` og `db/seed.js` sem eina sannleikslind (Single Source of Truth), og fjarlægja eldri Mode A/B/C first-person/overview tilraunir úr `action-ui-lab` ef Top-Down er orðin framtíðarstefnan?

### DESIGN-4: Tenging milli *The Goblin Chieftain* (Story Quest) og *The Watcher's Board* (Bounty System)
- **Núverandi staða:** Bæði *Quests [J]* (nýja söguverkefnið hjá Captain Vane) og *The Watcher's Board* (Phase 5/7C bounty-kerfið) eru til staðar í kerfinu, en í einfaldaða Top-Down viðmótinu opnar `Quests [J]` söguverkefnið *The Goblin Chieftain*.
- **Spurning til eiganda:** Eiga söguverkefni (*Story Quests*) og veiðisamningar (*Watcher's Board Bounties*) að vera tvær flipasíður í sama *Quests & Bounties [J]* glugga í Oakhaven, eða á *Watcher's Board* að bætast við síðar þegar leikmaður nær t.d. Level 2?
