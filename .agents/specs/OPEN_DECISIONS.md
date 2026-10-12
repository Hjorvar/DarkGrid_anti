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

## 2. Efnahagur og búnaður (fyrir Phase 4)

1. **Byrjunargull og byrjunarverslun:**
   - Hversu mikið gull fær ný hetja (nú sett sem 50 gp í config)?
   - Hvaða vopn og brynjur eru í boði í byrjun og hvaða takmarkanir gilda um Ranger og Cleric?
2. **Shared marketplace reglur:**
   - Þegar magical item er selt og fer á sameiginlegan markað: hvernig er verðlagning reiknuð (t.d. 50% af kaupverði, eða frjálst verð)?
   - Fyrnist varan ef enginn kaupir hana?

---

## 3. Kort og heimur

3. **Anti-farming regla:**
   - Hvernig á að hindra að spilari labbi fram og til baka milli tveggja reita í öruggum jaðri til að farma random encounters án þess að eyðileggja upplifunina á nýjum heimsóknum?
4. **Heimsstærð og framtíðarkort:**
   - Nú er notað 15×15 seed-kort (225 reitir). Á heimurinn að stækka í áföngum eða vera fastur fyrirframgerður heimur?
