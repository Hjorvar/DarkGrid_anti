# DARKGRID — PHASE 7A.3: AUTHORITATIVE DESIGN DECISIONS & PROPOSALS

**Date:** 2026-10-22  
**Phase:** 7A.3 — Final Design Corrections, Monster Families & Battle Experience  
**Status:** Authoritative Design Record (Separating Locked Owner Decisions from Testable Proposals)

---

## 1. Purpose of This Document

To prevent ambiguity during Phase 7B implementation, this document strictly separates:
- **Part A — Owner-Approved Locked Rules:** Non-negotiable architectural and mechanical mandates established by the owner in Phase 7A.3.
- **Part B — Technical & Balance Proposals for Owner Review / Phase 7B Testing:** Specific taxonomies, edge-case resolutions, and simulation tuning parameters designed to fulfill the owner's directives.

---

## 2. Part A — Owner-Approved Locked Rules (Non-Negotiable)

### A.1 Core Class Philosophy ("Different, Not Equal")
1. **No Numerical Class Parity:** Do not equalize general direct-combat win rates across classes. Retire Phase 7A.1 `Gate G2` permanently.
2. **Fighter — *The Survivor*:**
   - Strongest general combatant across all monster categories.
   - Proficient with **all** weapons, armor, and shields.
   - Highest base HP (`d10`) and armor scaling.
   - Automatic martial/humanoid expertise (*Know Your Enemy*).
   - **Second Wind** acts as both a critical-HP recovery and a once-per-combat **Lethal Rescue** against fatal standard damage blows.
3. **Ranger — *The Hunter*:**
   - Best at detecting monsters early (`DISCOVERED`) and avoiding `SURPRISED` ambushes.
   - **Opening Shot** triggers automatically before Round 1 when `DISCOVERED` and holding a readied ranged weapon (`primary_weapon === 'RANGED'`), and **can kill the monster outright** with full XP, loot, bounty, and Battle Experience credit.
   - Selects **ONE natural Favored Enemy family** (`monster_family`) at character creation.
   - Automatic wilderness expertise (*Natural Knowledge*) and superior retreat (*Evasive Retreat*).
4. **Cleric — *The Undead Hunter*:**
   - Intentionally weaker in general mundane combat against non-undead foes.
   - Dominant specialist against **Undead** via *Undead Knowledge*, *Sacred Strike*, *Turn Undead*, and *Holy Protection*.
   - **Divine Self-Healing** is strictly **out-of-combat only**, consuming sacred prayer charges that recharge only when resting in a city sanctuary.

### A.2 Ranger Favored Enemy Rules
1. **Reject Blended Categories:** The 7 blended Phase 7A.2 groupings (e.g., `Gnolls, Reptilians & Giants`, `Arachnids, Vermin & Deadly Flora`) are rejected.
2. **Natural Kinship Families (`monster_family`):** Every Favored Enemy choice must represent a single natural family of related creatures, stored in a stable `monster_family` identifier separate from Pathfinder `creature_type`.
3. **Small Families Allowed:** A family may contain only `1` or `2` monsters today (e.g., `TROLLS`, `GIANTS`, `ORCS`, `GNOLLS`) without being merged into an artificial grab-bag.
4. **Undead Strictly Forbidden:** `UNDEAD` may **never** be selected as a Ranger Favored Enemy.
5. **Non-Universal Coverage Allowed:** Not every monster in the 98-monster database is required to belong to a default Ranger-selectable Favored Enemy option (e.g., `UNDEAD`, `CONSTRUCTS`, `OOZES`).

### A.3 World Habitats & Future Biomes
1. **Do Not Tamper with Natural Habitats:** Monster habitats must not be altered to force underground, mountain, desert, or coastal creatures onto the current surface map.
2. **Surface Reachability Requirement Removed:** There is no requirement that all `98` monsters spawn on the current `001_seed_world.sql` map.
3. **Future Biome Expansion Deferred:** Caves, Mountains, Dungeons, Crypts, Underground Ruins, Coastlines, Rivers, and Aquatic regions remain separate future world-expansion tasks outside Phase 7B.

### A.4 Free Attribute Allocation & Progression
1. **Creation Rules:**
   - Six attributes: `STR`, `DEX`, `CON`, `INT`, `WIS`, `CHA`.
   - Total starting pool: **`72` points**.
   - Universal creation minimum: **`8`**; universal creation maximum: **`18`**.
   - Players allocate points freely across all six attributes; class-specific presets are optional defaults, not forced constraints:
     - **Fighter Preset:** `STR 14, DEX 12, CON 14, INT 10, WIS 12, CHA 10` (`Total = 72`)
     - **Ranger Preset:** `STR 10, DEX 16, CON 12, INT 10, WIS 14, CHA 10` (`Total = 72`)
     - **Cleric Preset:** `STR 12, DEX 10, CON 12, INT 10, WIS 16, CHA 12` (`Total = 72`)
2. **Level-Up Allocation:**
   - At Levels **`2, 4, 6, 8, and 10`**, the player receives **`+1` attribute point** (`5` total across Levels 1–10).
   - No automatic allocation; unspent points persist across sessions.
   - Creation cap `18` does **not** block Level-Up investment above `18`.
   - **Retroactive Constitution:** Any change in `CON` modifier ($\Delta M_{\text{con}}$) at Level $L$ adjusts `Max HP` by $L \times \Delta M_{\text{con}}$ and adjusts `Current HP` by the same delta without granting a free full heal.
3. **Hidden Mathematics with Visible Allocation Numbers:**
   - Players **do see** their raw attribute integers (`8–18+`) and remaining unspent points during Character Creation and Level-Up allocation.
   - Players **do NOT see** combat modifiers (`+2`), hit chances, damage bonuses, AC formulas, or internal lookup tables. Descriptive attribute tiers remain primary elsewhere in the UI.

### A.5 Battle Experience (Learned Enemy Knowledge)
1. **Victory-Driven Learning:** A hero learns to fight a specific monster species (`monster_id`) **only by defeating it**. Fleeing, spotting, or investigating grants zero Battle Experience.
2. **Milestones:**
   - **1st Victory — *Recognized***
   - **3rd Victory — *Experienced*** (hard ceiling; no further scaling after 3 wins).
3. **Attribute Roles:**
   - **`INT`** grants a hidden learned **damage bonus** against `Recognized` / `Experienced` species.
   - **`WIS`** grants a hidden learned **AC bonus** against `Recognized` / `Experienced` species.
   - **No General `INT` XP Multiplier:** Remove the `+10% XP per +1 INT_mod` multiplier (`calculateXpWithIntelligence`) from the design.
4. **0-Win Low-Stat Penalties (`8–9`):**
   - Against a monster species with `0` prior victories, `INT 8–9` applies `-1 Damage` and `WIS 8–9` applies `-1 AC`.
   - Both penalties disappear permanently against that species after the **1st victory** (`Recognized`).
   - **Class Specialization Exemption:** Neither penalty applies if the hero's class specialization covers that monster (Fighter *Know Your Enemy*, Ranger *Favored Enemy* / *Natural Knowledge*, Cleric *Undead Knowledge*).
5. **Character-Scoped & Permadeath-Bound:**
   - Stored per `character_id` + `monster_id`; survives logout/login and reload; **never** inherited by a new character after permadeath.
   - Persistent wounded monsters award the victory to the hero who lands the killing blow (including a lethal Ranger *Opening Shot*).

### A.6 Monster Knowledge (Approved Option A)
1. **Automatic & Passive:** Class monster knowledge (*Know Your Enemy*, *Natural Knowledge* + *Favored Enemy*, *Undead Knowledge*) triggers automatically without adding any new combat action buttons.
2. **Qualitative English Combat Prose:** All player-facing recognition and Battle Experience feedback uses atmospheric English text (`"You remember how this creature fights."`, `"You have learned to anticipate its attacks."`), never raw numbers.

---

## 3. Part B — Proposals Requiring Owner Confirmation Before Phase 7B Coding

While all core rules above are locked, the following **five specific engineering/tuning proposals** are documented for owner confirmation before Phase 7B code begins:

| # | Area | Phase 7A.3 Proposal | Reference Document |
|---:|---|---|---|
| **P1** | **Ranger Selectable `monster_family` List (`14` Core vs. `16` Extended)** | Expose **14 natural wilderness/humanoid families** in the Character Creation dropdown (`ANIMALS`, `MAGICAL_BEASTS`, `GOBLINOIDS`, `ORCS`, `GNOLLS`, `REPTILIAN_HUMANOIDS`, `AMPHIBIAN_HUMANOIDS`, `TROLLS`, `GIANTS`, `DRAGONS_DRAKES`, `ARACHNIDS`, `VERMIN_INSECTS`, `DANGEROUS_PLANTS`, `FEY`), with an optional toggle to include `MONSTROUS_HUMANOIDS` (`8`) and `ABERRATIONS` (`7`). Keep `SUBTERRANEAN_HUMANOIDS` (`2`) unlocked with future Underdark maps, and keep `OOZES` (`1`), `CONSTRUCTS` (`1`), and `UNDEAD` (`12`) non-selectable. | [`PHASE-7A3-RANGER-FAMILIES.md`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/docs/phase-7a3/PHASE-7A3-RANGER-FAMILIES.md) |
| **P2** | **`MAGICAL_BEASTS` Family Granularity (`19` Unified vs. Split)** | Keep the `19` non-insect/non-arachnid Magical Beasts unified under `MAGICAL_BEASTS` (*Magical Beasts & Chimeric Predators*) by default, OR optionally split out `LUPINE_CANINE_BEASTS` (`#24 Death Dog`, `#38 Winter Wolf`, `#45 Blink Dog`, `#75 Worg` = `4`) and `AVIAN_CHIMERAS` (`#8 Manticore`, `#27 Cockatrice`, `#52 Griffon`, `#58 Peryton`, `#76 Hippogriff` = `5`). | [`PHASE-7A3-RANGER-FAMILIES.md`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/docs/phase-7a3/PHASE-7A3-RANGER-FAMILIES.md) |
| **P3** | **Battle Experience Internal Table Verification** | Retain the owner's proposed internal table (`INT 18+` = `+2/+4` Dmg, `WIS 18+` = `+2/+3` AC) unaltered for Phase 7B implementation. Monte Carlo simulations confirm that even at `INT 18` after `3` wins, a `STR 18` Fighter (`87.2%` win rate vs Hobgoblin Captain) outperforms an `INT 18` Fighter (`75.0%` win rate), proving `INT/WIS` rewards investment without replacing `STR/DEX/CON`. | [`PHASE-7A3-BATTLE-EXPERIENCE.md`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/docs/phase-7a3/PHASE-7A3-BATTLE-EXPERIENCE.md) |
| **P4** | **Second Wind vs. Multi-Hit & Instant-Death Hazards** | Resolve *Second Wind* **once per monster turn after total turn damage is summed** (so multi-hit `REND` or `ELEMENTAL_RIDER` cannot double-tap a Fighter in the same action), allow *Second Wind* to rescue against fatal `POISON`/`BLEED` DoT ticks, and do **not** allow *Second Wind* to rescue against non-HP `CALCIFY` (`Cockatrice`/`Basilisk` petrification at `2` stacks). | [`PHASE-7A3-SECOND-WIND.md`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/docs/phase-7a3/PHASE-7A3-SECOND-WIND.md) |
| **P5** | **`#36 Mummy` (Level 5 Undead) Seed Stat Review** | Flag `#36 Mummy` (`AC 20, AB +14, 1d8+10, HP 45, DR 3/-`) for owner awareness: its `AB +14` and `1d8+10` damage are `4–5` points above all other Level 5 monsters (`AB +8..+10`), resulting in a `2.9%` L5 Cleric win rate (`84%` at L8). Recommend keeping seed data untouched in Phase 7A.3 and optionally tuning `#36 Mummy` to `AB +10, 1d8+6` or `solo_level = 6` in a future monster pass. | [`PHASE-7A3-SIMULATION-PLAN.md`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/docs/phase-7a3/PHASE-7A3-SIMULATION-PLAN.md) |
