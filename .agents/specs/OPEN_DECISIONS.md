# DARKGRID — Opnar ákvarðanir og næstu skref

Þetta skjal tekur saman atriði sem eru merkt **[ÓÁKVEÐIÐ]** eða **[TILLAGA]** í `DARKGRID_GAME_SPEC.md` og bíða staðfestingar höfundar fyrir næstu áfanga.

---

## 1. Bardagakerfi og varanleg skrímsli (Session 3 & 4 staða)

Sjá nákvæma heildarúttekt og hönnun í [`docs/combat-system-plan.md`](../../docs/combat-system-plan.md).

### ✅ Ákvarðanir staðfestar af höfundi í Session 3 & 4:
1. **Aðgerðir í bardaga:** Nákvæmlega þrjár aðgerðir í v1: `Attack`, `Drink Potion` og `Flee`. Engin `Defend` eða galdrar í fyrstu útgáfu.
2. **Eigin HP hetjunnar:** Spilari sér sitt eigið HP sem tölu (t.d. `24 / 35`) og fjölda healing potions. Tölur óvinarins (HP, AC, Attack Bonus, teningaköst, skaði) eru 100% faldar.
3. **Frumkvæði (Initiative):** Kastað einu sinni við upphaf bardaga (`1d20 + init_bonus`) til að ákvarða hvor framkvæmir á undan í umferðum. Jafntefli fellur hetjunni í hag.
4. **Flótti (Flee):** Flótti yfirtekur umferðarflæði. Skrímslið fær nákvæmlega eina fría árás (Attack of Opportunity). Ef spilari lifir af tekst flótti, ferðalás opnast og spilari helst á núverandi reit. Skrímsli fær **aldrei** tvær árásir við flótta.
5. **Heilsulýsingar skrímsla:** Notaðar eru fimm ástandslýsingar úr `monsters.descriptions` (`5_health_100` til `9_dead`). Textinn birtist eingöngu þegar heilsufarsflokkur lækkar, aldrei endurtekinn í hverri umferð.
6. **Varanleg skrímsli (Persistent Monsters):** Aðeins skrímsli sem drepa spilara festast á reitnum. Fá +10% max HP einu sinni (`Math.ceil(base_hp * 1.10)`). Engin önnur bónusgildi.
7. **Heilsufar varanlegra skrímsla:** Byrja hvern nýjan bardaga með fullt HP miðað við styrkt hámark í v1.
8. **Persistent Monsters og Ignore:** Spilari fær viðvörun í Stage 1 (Discovered) og getur valið `Investigate` eða `Ignore`. Ef hann hunsar skrímslið helst það á reitnum. Persistent monster hefur alltaf forgang fram yfir random encounters.
9. **Loot við dauða:** 50% gulls flyst á skrímslið, 50% hverfur. Hvert item í eigu hetjunnar (bæði í bakpoka og equipped vopn/brynja/potions) fer í 50% líkindapróf. Hámark 20 items á persistent monster (forgangsraðað eftir töframætti, verðgildi og ID).
10. **Upphafsvopn og brynja:** Ný hetja fær raunveruleg vopn og brynju í `item_instances` miðað við class (Fighter: Longsword 1d8, Chain Shirt AC +4; Ranger: Shortbow 1d6, Leather Armor AC +2; Cleric: Heavy Mace 1d8, Scale Mail AC +5).
11. **Upphafsdrykkir (Potions):** Ný hetja byrjar með 2 Minor Healing Potions í `item_instances` (læknar `1d8+1` HP, hámarkað við max HP).
12. **Öryggi og Idempotency:** Vörn gegn tvísmellum/replay með umferðarstaðfestingu, atómar transactions við dauða/loot/sigur, læsing á látnum persónum (`is_alive = 1`).

---

## 2. Efnahagur og búnaður

1. **Byrjunargull og byrjunarverslun:**
   - Staðfest regla: Ný hetja fær **10 gp** í byrjunargull (samkvæmt `config.startingGold` og prófum).
   - Upphafsbúnaður er veittur samkvæmt stétt (Class Starting Equipment).
2. **Shared marketplace reglur:**
   - Þegar magical item er selt og fer á sameiginlegan markað: seljandi fær 50% af kaupverði strax, og varan er skráð á sama 50% verði í `market_listings`.
   - Fyrnist varan ef enginn kaupir hana? [Bíður ákvörðunar].

---

## 3. Leikjajafnvægi til ákvörðunar (Session 3 úttekt)

1. **M4 — Dauðahætta nýrra hetja við borgarjaðar:**
   - Tillaga: Lækka `maxCr` í 0.25 á reitabilinu `distance = 1` svo skrímsli eins og Orc (CR 1/3, 2d4+4 greataxe skaði) spawni ekki strax á reit (7,8) við hlið Eikahafnar.
2. **M5 — Loot Economy (Veik skrímsli og dýr búnaður):**
   - Tillaga: CR-skipt loot töflur og útilokun á herklæðum/vopnum hjá dýrum/óvættum (Vermin/Animal/Beast) svo Goblin/Dire Rat geti ekki droppað Full Plate eða Greatsword.
3. **M8 — Ambush (Vélræn áhrif og texti):**
   - Tillaga: Láta skrímsli sjálfkrafa vinna frumkvæði í Round 1 þegar um ambush er að ræða (`initiative_winner = 'MONSTER'`), í samræmi við viðmótstextann „A shadowy shape lunges from the darkness without warning!“.
4. **L14 — Monster Level 6–10:**
   - Staða: Núverandi skrímslasafn er 38 skrímsli á level 1–5, en hetjur geta farið í level 10.
   - Tillaga: Skilgreina Phase 4 stækkunarpakka með 20 nýjum skrímslum á level 6–10 með sérsniðnum myndum og 9-lýsinga secrecy kubbum.

---

## 4. Kort og heimur

1. **Anti-farming regla:**
   - Hvernig á að hindra að spilari labbi fram og til baka milli tveggja reita í öruggum jaðri til að farma random encounters án þess að eyðileggja upplifunina á nýjum heimsóknum?
2. **Heimsstærð og framtíðarkort:**
   - Nú er notað 15×15 seed-kort (225 reitir). Á heimurinn að stækka í áföngum eða vera fastur fyrirframgerður heimur?
