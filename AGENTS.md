# Darkgrid — Agent Onboarding & Project Index

Velkomin(n) í **Darkgrid**, textamiðað dark fantasy single-player RPG með shared-world multiplayer áhrifum og permadeath.

---

## ⚡ Flýtivísar (Quick Commands)

```bash
# Setja upp gagnagrunn (migrations og seeds)
npm run setup:db

# Keyra öll sjálfvirk próf
npm test

# Ræsa þjóninn í þróunarham (með nodemon á http://localhost:3000)
npm run dev
```

---

## 📂 Uppbygging reglna og skjala (`.agents/` og `docs/`)

Öll upprunaleg regluskjöl, leikjahönnun, verkáætlanir og tilvísunargögn eru skipulögð í `.agents/` og `docs/` möppunum:

- **Aðalskjal bardagakerfis (Combat & Persistent Monsters):** [`docs/combat-system-plan.md`](docs/combat-system-plan.md)
  - Fullkomin hönnunarforskrift fyrir Phase 2 og Phase 3: 3 aðgerðir, faldar tölur, 9 ástandslýsingar, permadeath, persistent monsters og prófunaráætlun.
- **Reglur fyrir agents:** [`.agents/rules/darkgrid_rules.md`](.agents/rules/darkgrid_rules.md)
  - Meginreglur um arkitektúr, server-side truth, SQLite reglur og prófanir.
- **Tungumálastefna (Language Policy):** [`.agents/rules/language.md`](.agents/rules/language.md)
  - Ófrávíkjanleg regla: Leikurinn er eingöngu á ensku fyrir leikmenn (English-only player-facing text).
- **Viðmótsreglur (UI Rules):** [`.agents/rules/game-ui.md`](.agents/rules/game-ui.md) og [`docs/game-ui-style.md`](docs/game-ui-style.md)
  - Opinberar viðmótsreglur, litakerfi, leturfræði og framsetning skrímslamynda.
- **Leynd og afhjúpun skrímsla (Encounter Secrecy):** [`.agents/rules/encounter-design.md`](.agents/rules/encounter-design.md) og [`docs/encounter-design.md`](docs/encounter-design.md)
  - Ófrávíkjanleg regla um leynd ógnar, óljósar vísbendingar og afhjúpun skrímsla.
- **Skrímslamyndir og stíll:** [`.agents/rules/monster-art.md`](.agents/rules/monster-art.md) og [`docs/monster-art-style.md`](docs/monster-art-style.md)
  - Lýsingar og kvaðir fyrir handmálaðar 2D myndskreytingar á skrímslum.
- **Hönnunarforskrift leiksins:** [`.agents/specs/DARKGRID_GAME_SPEC.md`](.agents/specs/DARKGRID_GAME_SPEC.md)
  - Aðalskjal með reglum, stéttum, tölfræði, d20 vélfræði og framtíðarsýn.
- **Áfangaskipt verkáætlun:** [`.agents/specs/DARKGRID_IMPLEMENTATION_PLAN.md`](.agents/specs/DARKGRID_IMPLEMENTATION_PLAN.md)
  - Yfirlit yfir Phase 1 til Phase 5.
- **Opnar ákvarðanir:** [`.agents/specs/OPEN_DECISIONS.md`](.agents/specs/OPEN_DECISIONS.md)
  - Samantekt á óákveðnum atriðum sem bíða hönnunar/ákvörðunar.
- **Upprunaleg vinnu-SQL:** [`.agents/reference/`](.agents/reference/)
  - `schema_draft.sql` og `seed_assassin_vine.sql`.

---

## 🏛️ Kóðauppbygging (Code Architecture)

- `src/domain/` — Hrein lénsrökfræði (domain logic) án Express-tenginga:
  - `auth/` — Auðkenning og lykilorðadulkóðun.
  - `character/` — Hetjustofnun, stigareikningar og d20 bónusar.
  - `world/` — Heimskort, 5x5 minimap og hreyfireglur.
  - `encounters/` — Gaussian skrímslaval, landslagsíun og textalýsingar.
  - `combat/` — Bardagakerfi (dice, rules, engine, narrative): 3 aðgerðir, d20 vélfræði, faldar tölur.
  - `monsters/` — Varanleg skrímsli (persistence): permadeath, loot-tilfærslur, +10% HP boost.
- `src/routes/` — Express routing fyrir vefviðmót (`/game/combat/*`, `/game/fallen`, o.fl.).
- `src/views/` — EJS templates með dökkum stíl (`game.ejs`, `fallen.ejs`).
- `db/` — SQLite migrations og seeds (`better-sqlite3`).
- `tests/` — Node.js innbyggt test runner (`node --test`).

---

## 📌 Núverandi staða
- **Phase 1, Phase 2 (Combat System) og Phase 3 (Persistent Monsters & Permadeath) eru fullkláruð og staðfest með 57 sjálfvirkum prófum (100% pass).**
- **Session 3 & 4 hönnun og framkvæmd liggja fyrir í [`docs/combat-system-plan.md`](docs/combat-system-plan.md).**
