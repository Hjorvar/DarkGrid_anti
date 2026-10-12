# DARKGRID — START HERE (fyrstu fyrirmæli til coding agent)

Þú ert að vinna að nýjum vefleik: **Darkgrid**, textamiðuðum dark fantasy single-player RPG með shared-world multiplayer áhrifum og permadeath.

**Lestu í þessari röð:**
1. `DARKGRID_GAME_SPEC.md` — heildarhugmynd og reglur; aðgreinir [ÁKVEÐIÐ], [TILLAGA] og [ÓÁKVEÐIÐ].
2. `DARKGRID_IMPLEMENTATION_PLAN.md` — hvað á að útfæra, í hvaða röð og með hvaða prófum.
3. `schema_draft.sql` og `seed_assassin_vine.sql` — vinnugögn til að vinna úr, ekki heilög forskrift.

## Verkefnið þitt NÚNA

**Útfærðu eingöngu Phase 1: fyrstu keyranlegu útgáfuna sem ég get opnað í vafra.**

Gerðu þessi atriði:
- Register/Login.
- Create Character með Fighter/Ranger/Cleric, réttum stats og validation.
- SQLite, migrations og eitt lítið seed-kort.
- Dökkan aðalskjá: heiti svæðis, minimap, tile-lýsing, aðgerðir og N/S/A/V.
- Persisted movement og encounter-check á server.
- Normal-weighted monster selection by hero level, terrain-filter (`FOREST → F`, `JUNGLE → J`, `SWAMP → S`), configurable 25% encounter chance + sigma=1.5.
- Níu sérsniðnar JSON-lýsingar fyrir Assassin Vine, Rangers fá betri distant/close lýsingar.
- Investigate / Ignore. Bardagi má vera staðgengill í Phase 1; **ekki byrja á fullu bardagakerfi**.

**Mikilvæg regla:** Ég vil sjá eitthvað *á skjá* sem fyrst. Ekki fresta sýnilega leiknum á meðan þú forritar alla multiplayer-, loot- og bardagavélina.

## Aðferð

- Ef repo er þegar til: skoðaðu það og notaðu núverandi tækni; ekki yfirskrifa.
- Ef tómt: einfaldur Node.js/Express + SQLite + HTML/EJS/CSS/JS er góð byrjun.
- Notaðu server-side rules; frontend er birting og aðgerðir.
- Prófaðu hverja einingu. Bættu skýrum `README.md` með start commands.
- Ekki festa óákveðnar tölur eða class-abilities í kóða. Notaðu config/TODO.
- Eftir Phase 1: skilaðu því sem virkar, leiðinni til að ræsa, og stuttum lista af spurningum sem þurfa ákvörðun síðar. **Ekki hefja Phase 2 fyrr en ég hef skoðað skjáinn.**

## Árangursmælikvarði

Ég get skráð mig, búið til löglega hetju, ferðast milli reita og fengið textalýst encounter; Ranger sér betri upplýsingar. Refresh breytir ekki kortastaðsetningu né encounter. Engar tölur um skaða eða HP skrímsla birtast.
