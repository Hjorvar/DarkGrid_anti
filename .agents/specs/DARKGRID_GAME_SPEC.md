# DARKGRID — Leikjahönnun og kerfislýsing

**Útgáfa:** 0.1 • **Dags.:** 12. október 2026 • **Staða:** Vinnuskjal fyrir þróun með coding agent

> **Hvernig lesa skal þetta skjal:**
> - **[ÁKVEÐIÐ]** = sett fram sem krafa frá höfundi leiksins.
> - **[TILLAGA]** = hönnunartillaga frá samtalinu; nota má sem tímabundna stillingu, en ekki gera hana að óbreytanlegri reglu.
> - **[ÓÁKVEÐIÐ]** = þarf að útfæra eða staðfesta síðar.
> - Sérstaklega á að forðast að fylla eyður með ósýnilegum, óafturkræfum ákvörðunum.

## 1. Sýn og lykilhugmynd

**[ÁKVEÐIÐ]** Darkgrid er vefleikur í dark fantasy stíl. Hann er í grunninn **single-player**, en allir spilarar tengjast **sama viðvarandi heimi**. Multiplayer-áhrif birtast einkum í tveimur kerfum:

1. Skrímsli sem drepa hetju verða **varanlega til staðar á þeim kortreit hjá öllum spilurum**, ásamt öllu sem fallna hetjan átti. Skrímslið safnar fjársjóði úr fleiri fórnarlömbum þar til önnur hetja drepur það.
2. Töfrahlutur seldur til verslunar birtist **á sameiginlegum markaði í öllum borgum**. Aðeins eitt eintak er til og fyrsta gilt kaup fjarlægja hann af markaðinum fyrir alla.

Einkenni upplifunarinnar:
- Ein lifandi hetja á notanda; varanlegur dauði (*permadeath*).
- Textamiðaður heimur með litlu yfirlitskorti og ferðastefnunum N/S/A/V.
- Bardagakerfi byggt lauslega á **Pathfinder 1e / d20**; ekki full Pathfinder-hermun.
- Nákvæmar tölur um skaða og HP óvina eru **faldar**; spilarinn fær lýsandi texta.
- Skrímsli tengjast landslagi og eiga **níu einstakar lýsingar** hvert.
- Random encounters fylgja normaldreifingu miðað við styrkleika hetjunnar.

**Hönnunarregla:** Hættumat, könnun og ákvarðanir skipta jafn miklu máli og að sigra í bardaga.

## 2. Notendareikningar og lífsferill hetju

**[ÁKVEÐIÐ]** Register/Login. Við innskráningu:

| Ástand | Leið |
|---|---|
| Notandi á lifandi hetju | Opna leikinn á núverandi staðsetningu |
| Engin hetja hefur verið búin til | Character Creation |
| Síðasta hetja er látin | Character Creation fyrir nýja hetju |

- Aðeins **ein lifandi hetja á hvern notanda**. Varnarregla bæði í backend og gagnagrunni.
- Fallin hetja kemur ekki til baka; ný hetja byrjar frá byrjun.
- Geyma söguleg gögn um látnar hetjur; eyða þeim ekki við nýja stofnun.
- **[TILLAGA]** Hall of the Fallen sýni síðar nafn, class, level, dauðastað, banaskrímsli og afrek.
- **[ÓÁKVEÐIÐ]** Hvað af notandareikningi lifir milli hetja (t.d. þekking á skrímslum) umfram sögu þeirra.

## 3. Character Creation

### 3.1 Class og grunnstats

**[ÁKVEÐIÐ]** Þrír classar:

| Stat | Fighter | Ranger | Cleric |
|---|---:|---:|---:|
| STR | 14 | 12 | 12 |
| CON | 12 | 10 | 10 |
| DEX | 12 | 14 | 10 |
| INT | 10 | 10 | **10\*** |
| WIS | 10 | 12 | 14 |
| CHA | 10 | 10 | 12 |
| HP á level | 10 | 8 | 8 |

\* Í fyrstu skilaboðum vantaði INT hjá Cleric; **10 er vinnuforsenda**, ekki staðfest breyting. Með þeirri forsendu er grunnsumma 68 hjá öllum classum.

### 3.2 Dreifing punkta

**[ÁKVEÐIÐ]**
- Þrír aukapunktar við stofnun. Einn punktur hækkar eitt stat um 1.
- Hægt er að lækka **hvert** grunnstat um allt að 2 og ráðstafa punktunum annað.
- Enginn eiginleiki má fara yfir **18 við stofnun**.
- Lokastaðfesting verður að standast: `sum(final_scores) = sum(class_base_scores) + 3` og `class_base[stat]-2 <= final[stat] <= 18`.
- Backend staðfestir reglurnar sjálfstætt, ekki aðeins vefviðmót.

Ability modifier (d20): `floor((score - 10) / 2)`.

| Stat | Vinnuhugmynd um hlutverk |
|---|---|
| STR | Melee árásir og skaði |
| CON | Þol og mögulegir HP-bónusar |
| DEX | Initiative, ranged árásir og AC |
| INT | Þekking / upplýsingar um verur |
| WIS | Skynjun, áhættumat og Cleric healing |
| CHA | Samskipti / verslun síðar |

**[ÓÁKVEÐIÐ]** Endanlegt gagn af INT og CHA, hvort CON modifier bætist við HP á hverju leveli og hve mikill sá bónus verður.

### 3.3 Upphafsverslun

**[ÁKVEÐIÐ]** Hetjan fær byrjunargull og kaupir vopn, brynju og lækningadrykki; óeytt gull helst hjá henni. Fighter hefur aðgang að öllum venjulegum vopnum og brynjum. Aðrir classar takmarkast af eigin notkunarreglum.

**[ÓÁKVEÐIÐ]** Magn byrjunargulls, verðskrá, búnaðartakmarkanir Ranger/Cleric, slots, burðargeta og fjöldi drykkja.

## 4. Class-hæfileikar

| Class | Ákveðin sérstaða | Tillögur til að prófa |
|---|---|---|
| Fighter | Öll vopn og brynjur; 10 HP/level | Defensive Stance, betri vörn eða bardagaþol |
| Ranger | Betri upplýsingar um skrímsli úr fjarlægð og í návígi; 8 HP/level | Betra áhættumat, flótti, ranged-sérhæfing |
| Cleric | Sjálfslækning að einhverju marki; 8 HP/level | Takmörkuð notkun lækninga, byggt á WIS |

**[ÓÁKVEÐIÐ]** Nákvæmir bónusar, cooldowns, hvenær sjálfslækning endurnýjast, class-sértækar árásir. Classarnir verða allir að geta lifað af einir.

## 5. Kort, landslag og ferðalög

**[ÁKVEÐIÐ]** Eitt stórt sameiginlegt hnitakort. Hver reitur hefur terrain, staðarlýsingu og mögulega athafnir. Hreyfing er á milli nágrannareita í **North, South, East, West**.

Landslagsflokkar sem hafa verið nefndir:

1. Aquatic / Water
2. Ocean / Sea
3. River / Lakes
4. Forest
5. Jungle
6. Bog / Marsh / Swamp
7. Plains
8. Hills
9. Mountains
10. Desert
11. Coastal / Coastline
12. City / Urban
13. Underground / Ruins
14. Extraplanar
15. Other
16. Bridge

**[TILLAGA]** Nota stöðug tæknigildi fyrir terrain (`FOREST`, `SWAMP` o.s.frv.) og geyma `City`, `Bridge`, `Ruins` líka sem mögulega **feature** á reit: brú getur verið yfir á í skógi. Í fyrstu útgáfu má hafa einn aðalflokk og aukareit fyrir feature.

- Hver reitur hefur nafn, textalýsingu, hnit og ákvörðun um hvort þangað megi ferðast.
- Borgir eru örugg svæði, a.m.k. gagnvart venjulegum random encounters **[TILLAGA]**.
- Ekki er hægt að ganga yfir öll vatnasvæði án sérstaks búnaðar **[TILLAGA]**.
- **[ÓÁKVEÐIÐ]** Kortastærð, fyrirframgerður vs. generated heimur, ferðatakmarkanir, svæði með fasta hættu, hversu mikið spilarinn sér af kortinu.

### Aðalskjár leiks

**[ÁKVEÐIÐ]**
1. Stórt heiti terrain / svæðis efst.
2. Lítið nærliggjandi kort við hliðina.
3. Lýsing á núverandi reit undir.
4. Texti og aðgerðir sem eru í boði: skoða skrímsli, heimsækja búð, o.s.frv.
5. Ferðastefnurnar fjórar neðst.
6. Aðgangur að Character / Inventory / Equipment **[TILLAGA]**.

Útlit: dökkt, læsilegt, textamiðað dark fantasy; mikilvægar ákvarðanir fá skýra hnappa. Forðast að troða tölum í bardagaviðmótið.

## 6. Skrímslasafn: `monsters`

**[ÁKVEÐIÐ]** Hver skrímslategund er í gagnagrunni með stats, `habitat`, `movement_type` og **nákvæmlega níu sérsniðnum lýsingum** í JSON. Textinn er einstaklingsbundinn fyrir *tegundina*, ekki almennur texti sem er endurnotaður.

Dálkar úr frumhugmynd:

- `name`, `symbol`, `color`, `base_hp`, `xp_reward`, `damage_dice`
- `initiative_bonus`, `armor_class`, `attack_bonus`, `challenge_rating`
- `habitat` (JSON-array landslagskóða)
- `movement_type` (`WALK`, `FLY` o.s.frv.)
- `descriptions` (JSON-object)

**[TILLAGA]** Bæta við `id`, `solo_level`, `spawn_weight`, `special_abilities`, `source_url` og mögulega fleiri Pathfinder-upplýsingum (resistances, reach, attacks). Þannig skiljum við á milli Pathfinder CR og raunhæfs erfiðleikastigs fyrir **eina** hetju.

### 6.1 Nákvæmu níu lýsingarlyklarnir

| Lykill | Notkun |
|---|---|
| `1_distant` | Óljós lýsing þegar venjuleg hetja verður vör við skrímsli |
| `2_ranger_distant` | Upplýsandi, sérsniðin útgáfa fyrir Ranger |
| `3_close` | Nákvæmari lýsing þegar bardagi hefst |
| `4_ranger_close` | Sérstakar upplýsingar Ranger við nánari skoðun |
| `5_health_100` | Skrímsli hefur 76–100% HP eftir |
| `6_health_75` | 51–75% HP eftir |
| `7_health_50` | 26–50% HP eftir |
| `8_health_25` | 1–25% HP eftir |
| `9_dead` | HP = 0, dautt |

Þessar lýsingar koma beint úr `monsters.descriptions`. Spilarinn sér **ekki HP-tölur** fyrir skrímsli.

- Ranger-lýsing á að hjálpa við hættumat og hegðun, **ekki** bara vera lengri málsgrein.
- Áverkalýsingar verða að passa líffræði viðkomandi skrímslis (t.d. plantan lekur safa; beinagrind blæðir ekki).
- Nákvæmar tölur fyrir attack/defense/HP eru varðveittar í backend en faldar í bardagaframsetningu.
- Bardagalýsingar um hit/miss/damage eru **aðskildar** frá þessum níu lýsingum.
- **[ÓÁKVEÐIÐ]** Hvort Ranger sér bæði venjulegu lýsinguna og Ranger-lýsinguna eða aðeins þá betri; byrja má á þeirri betri.

### 6.2 Dæmi: Assassin Vine

Höfundur hefur samið níu lýsingar fyrir Assassin Vine (sjá `seed_assassin_vine.sql`). Pathfinder 1e heimildin er:
https://www.d20pfsrd.com/bestiary/monster-listings/plants/assassin-vine/

Staðfest viðmið úr heimild: CR 3, XP 800, HP 30, AC 15, initiative +0, slam attack +7, **damage `1d8+7`**. `4d8+12` lýsir Hit Dice / HP-grunni, **ekki** árásarskaða. Sérhæfileikar eru m.a. `grab`, `constrict`, `entangle`, `camouflage`.

`habitat: ["F","J","S"]` er skráð í dæmi höfundar; `F` = Forest, `J` = Jungle, `S` = Swamp samkvæmt vinnukóðun. Jungle er hér val leikhönnuðar, ekki krafa úr upprunalega vistkerfisreitnum. **Mikilvægt tæknilega:** `map_tiles.terrain` geymir `FOREST`/`JUNGLE`/`SWAMP` en `monsters.habitat` geymir `F`/`J`/`S`. Backend verður að hafa skýra vörpun (`FOREST → F`, `JUNGLE → J`, `SWAMP → S`) áður en hann síar skrímsli. Staðfesta og bæta við kóðum fyrir önnur terrain síðar.

**Réttindamál:** Heimildin er til rannsókna og sem grunnur að frumrituðum texta. Ekki afrita myndir, Protected/Product Identity eða langa lýsingartexta. Meta OGL/ORC og viðeigandi atribúsjón áður en efni er birt opinberlega.

## 7. Random encounters — tveggja þrepa kerfi

### 7.1 Koma á reit

1. Backend staðfestir löglega ferð og færir hetjuna á reit.
2. Ef varanlegt skrímsli er þegar á reitnum, er **það** sýnt og ekki er kastað fyrir nýtt random encounter.
3. Annars, ef reitur leyfir random encounters, er athugað hvort skrímsli birtist.
4. Ef ekkert birtist: sýna venjulega lýsingu reits.
5. Ef skrímsli birtist: velja skrímsli með level/terrain-reglu og geyma *pending encounter* í backend. Birta `1_distant` eða `2_ranger_distant`.
6. Spilarinn velur **Investigate** (hefja bardaga) eða **Ignore** (halda áfram án bardaga).

**[TILLAGA]** Upphafslíkur `encounter_chance = 25%` fyrir reiti sem eru ekki öruggir. Þetta á að vera stillanleg tala, ekki hardcode í mörgum skrám.

### 7.2 Val á erfiðleikastigi — normaldreifing

**[ÁKVEÐIÐ]** Líklegast er að hitta skrímsli á **sama leveli og hetjan**; líkur minnka í báðar áttir. Fáein skrímsli mega vera miklu hættulegri eða auðveldari.

**[TILLAGA]** Nota `solo_level` í stað hrárrar `challenge_rating`; staðalfrávik `sigma = 1.5` til prófunar. Vigt fyrir hvert mögulegt skrímslastig `L` með hetjulevel `H`:

`weight(L) = exp(-((L - H)^2) / (2 * sigma^2))`

Til að varðveita normalformið óháð því hve margar tegundir eru á ákveðnu leveli:

1. Sía fyrst skrímslategundir sem mega birtast í viðkomandi terrain og hafa virkt `solo_level`.
2. Reikna normalvigt fyrir hvert **aðgengilegt level**, velja level með normalvigtum endurskölum í 100%.
3. Velja skrímslategund innan þess levels með `spawn_weight`.
4. Ef engar tegundir finnast er ekkert skrímsli valið (engin kerfisvilla).

Þannig hafa 20 tegundir á leveli 4 ekki sjálfkrafa 20-falt meiri áhrif á val á leveli en ein tegund á leveli 5.

**[TILLAGA]** `sigma=1.5` og 25% spawn-chance eru **prófunargildi**, ekki endanlegt balance.

### 7.3 Vörn gegn endurköstum og misnotkun

- **[TILLAGA]** Kasta aðeins við **nýtt, gilt ferðaskref**, ekki við page refresh.
- Pending encounter geymist í gagnagrunni þar til spilarinn hefur valið Investigate/Ignore.
- **[ÓÁKVEÐIÐ]** Hvernig hindra eigi farming með því að fara fram og til baka milli tveggja reita, án þess að afnema spawns á endurheimsóknum.

## 8. Bardagakerfi

> **Sjá nákvæma hönnunarforskrift í [`docs/combat-system-plan.md`](../../docs/combat-system-plan.md).**

### 8.1 Grunnreglur sem höfundur hefur ákveðið

- Turn-based bardagi, ein hetja gegn einu skrímsli í grunnútgáfu.
- **Frumkvæði (Initiative):** Kastað er `1d20 + initiative_bonus` við upphaf bardaga til að ákvarða hvor hefur frumkvæði í umferðum. Jafntefli fellur hetjunni í hag.
- **Þrjár löglegar aðgerðir spilara:**
  1. **Attack:** Ein árás með vopni. `d20 + attack_bonus >= armor_class`.
     - Natural 20: Critical hit sem veldur 2x venjulegum skaða.
     - Natural 1: Sjálfvirkt missi (automatic miss).
  2. **Drink Potion:** Drekka lækningadrykk úr bakpoka. Læknar HP, notar umferð spilarans. Skrímslið fær sína venjulegu árás. Ekki hægt ef spilari á 0 drykki.
  3. **Flee:** Flóttatilraun. Skrímslið fær nákvæmlega eina fría árás (Attack of Opportunity). Ef spilari lifir af tekst flótti og bardaga lýkur. Ef spilari deyr gilda permadeath-reglur. Skrímsli fær ekki bæði venjulega og fría árás vegna sömu aðgerðar.
- **Upprunaleg hetjuformúla:** `floor((STR_modifier + DEX_modifier) / 2)` sem attack bonus; engin samþykkt level-skalning enn.
- **Armor Class hetju:** `10 + DEX_modifier + armor_bonus + shield_bonus`.
- **Faldar tölur:** Spilarinn sér sitt eigið HP (t.d. 24 / 35) og potions, en tölur óvinarins (HP, AC, attack bonus, teningaköst, skaði) eru **100% faldar**.
- **Ástandslýsingar skrímsla:** Heilsulýsingar óvinarins nota níu-lýsinga kerfið (`5_health_100` til `9_dead`). Textinn birtist eingöngu þegar heilsufarsflokkur skrímslis lækkar, aldrei endurtekinn í hverri umferð.
- **Textalýsingar atburða:** Sérstök textasöfn fyrir miss, hit, critical hit, potion, fleeing, victory og death.
- Bardaga lýkur með sigri, dauða eða flótta.

## 9. Sigur, XP og loot

**[ÁKVEÐIÐ]** Ef hetjan sigrar skrímsli fær hún XP og aðgang að loot. Fjársjóður tengist tegund og hættustigi; magical items geta fundist og verið seld á sameiginlega markaðinum.

**[TILLAGA]** Loot-reglur aðgreini:
- venjulegan gull-/búnaðarloot fyrir humanoids,
- hráefni fyrir animals/plants,
- sjaldgæfari töfragripi hjá hættulegri verum,
- eignir fyrri fórnarlamba varanlegra skrímsla (þær eru **raunverulegir einstakir hlutir**, ekki ný random loot roll).

**[ÓÁKVEÐIÐ]** Nákvæm loot-tafla og líkur, rarity, item affixes, XP framvinda og max level. Tillaga úr umræðu: byrja með level 1–10 en þetta hefur ekki verið samþykkt.

## 10. Varanlegt skrímsli eftir dauða hetju (lykil-MP-kerfi)

**[ÁKVEÐIÐ]** Þegar skrímsli drepur hetju:
1. Hetjan er merkt látin (`is_alive = 0`, `died_at = CURRENT_TIMESTAMP`) og allar frekari leikaðgerðir stöðvaðar.
2. Skrímslið festist á reitnum sem **einstaklingur** í `monster_instances`, ekki ný skilgreining í `monsters`.
3. Skrímslið fær **+10% maximum HP** boost einu sinni (`Math.ceil(base_hp * 1.10)`). Engin önnur bónusgildi.
4. **Loot retention:** 50% gulls flyst á skrímslið (50% eyðist). Hvert item hefur 50% líkur á að varðveitast (afgangur eyðist). Hámark 20 items á persistent monster, forgangsraðað eftir töframætti, verðmæti og ID.
5. Skrímslið sést öllum spilurum á þessum reit; **enginn venjulegur random encounter** birtist þar á meðan.
6. Skrímslið byrjar hvern nýjan bardaga með fullt HP miðað við sitt styrkta hámark í v1.
7. Ef skrímslið drepur fleiri hetjur helst það á reitnum, fær meira loot (allt að 20 hluti) og `kill_count` hækkar, en það fær **ekki** annað HP boost.
8. Sá sem drepur þetta varanlega skrímsli fær varðveittan fjársjóð og XP; skrímslið fær stöðuna `DEFEATED` og reiturinn verður aftur venjulegur fyrir alla spilara.
9. **Atómar færslur:** Allur flutningur fer fram í gegnum SQLite transactions (`withTransaction`) til að koma í veg fyrir kapphlaup (race conditions) og tvöföldun á loot.

## 11. Borgir og shared marketplace (lykil-MP-kerfi)

**[ÁKVEÐIÐ]** Í borgum má lækna sig gegn gjaldi, selja hluti og kaupa venjulegan búnað. **Allar verslanir hafa sama úrval venjulegra vopna og brynja**; einnig lækningadrykki samkvæmt framboði.

- Venjulegir hlutir eru í stöðluðu, sameiginlegu vöruúrvali (ekki einstök birgðastaða hvers bæjar).
- Ef spilari selur magical item fær hann greiðslu og **eina raunverulega eintakið** fer í sameiginlegt söluframboð allra borga.
- Þegar einn annar spilari kaupir hlutinn hverfur hann samstundis úr öllum búðum.
- Ekki má tvöfalda sömu item-instance með samtímis kaupum/sölu eða endurteknum API-köllum.

**[ÓÁKVEÐIÐ]** Söluverð, kaupverð, hvort hlutir endi á markaði að eilífu eða fyrnist, framboð potions, hvort spilari geti keypt eigin selda hluti aftur.

## 12. Level, XP og framvinda

**[ÁKVEÐIÐ]** Hetjur safna XP, hækka level við ákveðin XP-mörk. Fighter fær 10 HP per level, Ranger/Cleric 8 samkvæmt upphafshugmynd.

**[ÓÁKVEÐIÐ]** XP tafla; hvort HP hámark hækkar um CON modifier; ability score upphækkanir með leveli; nýir class abilities; hvort HP fyllist við level up; hámarkslevel.

## 13. Gagnagrunnur og tæknileg hönnun

**[ÁKVEÐIÐ]** SQLite er fyrsti kostur. Notaðu **eina miðlæga gagnagrunnsskrá hjá leikjaþjóninum** fyrir sameiginlegan heim. Ekki sérstakan SQLite-gagnagrunn hjá hverjum spilara.

**[TILLAGA]** Node.js + Express backend, HTML/CSS/vanilla JS eða EJS frontend, SQLite með migrations og seed-skrám. Ef fyrirliggjandi repo notar aðra skynsamlega tækni, **endurnýta** hana og láta vita áður en henni er skipt út.

Meginhlutverk gagnasafns:

| Tafla / view | Hlutverk |
|---|---|
| `users` | Innskráning og notendareikningar |
| `map_tiles` | Staðsetningar, landslag, öryggi og reitalýsing |
| `characters` | Allar hetjur, lifandi og látnar; stats, level, XP, HP, gull og tile |
| `monsters` | Skrímslategundir, Pathfinder-tölur, habitat og níu JSON-lýsingar |
| `monster_instances` | Varanleg skrímsli á reitum, gold og kill count |
| `encounters` | Virkir eða afgreiddir persónulegir random bardagar |
| `item_definitions` | Tegundir vopna, brynja, drykkja og töfragripa |
| `item_instances` | Hvert eintak, eigandi og sérstakir eiginleikar |
| `character_inventory` (view) | Eignir hetju |
| `monster_loot` (view) | Eignir varanlegs skrímslis |
| `market_listings` | Einstakir töfrahlutir í sameiginlegu söluframboði |
| `combat_events` | Bardagalogg / endurheimtanlegt síðasta ástand |
| `game_config` | Stillingar í stað dreifðra hardcodes |

Sjá `schema_draft.sql` fyrir fyrstu **vinnugagnaskipan**. Skemanu má breyta með migrations; það er ekki fullnaðargagnalíkan.

### 13.1 Öryggi og race conditions

- Öll köst, bardaganiðurstöður, gull, XP, eigendabreytingar og spawns ákvarðast **á server**. Client sendir beiðnir um aðgerð, ekki niðurstöður.
- Notendalykilorð aldrei í plaintext; öruggar lykilorðahash-aðferðir, öruggar sessions/cookies, input validation og parametrized SQL.
- Krefjast þess að innskráður notandi **eigi** viðkomandi lifandi hetju fyrir hverja aðgerð.
- Nota transactions fyrir sigur/dauða/loot/sölu/kaup; tvöföldun hluta er óheimil.
- Eitt active encounter á hverja hetju. Page refresh má ekki endurkasta random encounter.
- Eitt active varanlegt skrímsli á reit í fyrstu hönnun, nema regla sé síðar breytt.
- SQLite: `PRAGMA foreign_keys=ON` á **hverri tengingu**, WAL þar sem uppsetning hentar (ein miðlæg vél; ekki network filesystem), `busy_timeout` og migrations.
- SQLite getur haft marga readers en aðeins einn writer í einu; metum aðra gagnagrunnslausn ef álag kallar á það.

## 14. Upphafleg notendaupplifun — „vertical slice“

Fyrsti skjálega prófanlegi búturinn þarf aðeins:
1. Register/Login.
2. Create Character (Fighter/Ranger/Cleric og lögleg punktadreifing).
3. Aðalskjá með landslagsheiti, litlu korti, texta og fjórum áttum.
4. Ferð milli reita í litlu seed-korti.
5. 25% stillanlegt encounter-check og levelvægt skrímslaval.
6. Fyrstu `distant`-lýsingar, Ranger-lýsingu og Investigate/Ignore.

**Aðeins eftir þetta:** þróa d20-bardaga, varanlegan dauða, varanleg skrímsli, búðir og sameiginlegt sölukerfi. Mikilvægara er að fá raunverulegt click-and-play á skjá en að fullgera allt í einu.

## 15. Opnar ákvarðanir — listi til að vinna með áfram

### Mikilvægt áður en bardagajafnvægi er fest
1. Staðfesta INT hjá Cleric = 10.
2. Attack formula: meðaltal STR/DEX (upprunalegt) eða STR melee/DEX ranged + class/level scaling (tillaga)?
3. CON og HP: föst 10/8 á level eða +CON modifier?
4. Sjást eigin HP-tölur hetjunnar eða aðeins texti?
5. Flótti úr bardaga, Defend, potions og class actions.
6. Nákvæmir Fighter/Ranger/Cleric hæfileikar og hversu oft má nota þá.
7. CR → `solo_level`: hvernig á að kalibrera gegn einni hetju?

### Mikilvægt fyrir loot/efnahag
8. Byrjunargull, venjuleg verð og byrjunarvörur.
9. Loot töflur, magical items, rarity og item slots.
10. Healing-kostnaður, endurnýjun heilsu og sölu-/kaupverð töfrahluta.
11. Reglur um HP varanlegs skrímslis á milli bardaga.

### Má ákveða þegar eitthvað er komið á skjáinn
12. Kortastærð, fjölbreytni í terrain, ferðahindranir og svæðishætta.
13. Útlitsstíll og hversu mikið kort sýnir.
14. XP tafla, max level og eiginleikahækkanir.
15. Anti-farming á fram-og-til-baka ferðalögum.
16. Saga hetja, titlar og mögulegt metakerfi.

## 16. Heimildir og athugasemdir

- Pathfinder 1e SRD: https://www.d20pfsrd.com/
- Assassin Vine: https://www.d20pfsrd.com/bestiary/monster-listings/plants/assassin-vine/
- Pathfinder bardagareglur: https://www.d20pfsrd.com/gamemastering/Combat/
- SQLite JSON: https://www.sqlite.org/json1.html
- SQLite WAL: https://www.sqlite.org/wal.html
- SQLite foreign keys: https://www.sqlite.org/foreignkeys.html
- Paizo leyfi og Product Identity: https://paizo.com/licenses

**Ath.:** Þetta verkefni er upprunalegur vefleikur sem sækir innblástur í Pathfinder/d20. Ekki merkja leikinn sem opinberan Pathfinder-leik eða nota vernduð vörumerki, heim, persónur eða myndir án heimildar. Endurskoða leyfis- og attribution-skyldur áður en leikurinn er birtur opinberlega.

---

**Stöðutexti fyrir agent:** Framkvæmdu aðeins fyrsta sýnilega *vertical slice* fyrst. Útfærðu kerfin aðskilin, lesanleg og prófanleg. Ekki breyta opnum ákvörðunum í endanlegar leikreglur.
