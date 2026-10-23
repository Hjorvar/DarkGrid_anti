# DARKGRID — PHASE 7B: MONSTER TAXONOMY AND KNOWLEDGE SYSTEM REPORT

**Date:** 2026-10-22  
**Authoritative Spec:** [`PHASE-7A4-FINAL-OWNER-DECISIONS.md`](../phase-7a4/PHASE-7A4-FINAL-OWNER-DECISIONS.md), [`PHASE-7A4-RANGER-TAXONOMY.md`](../phase-7a4/PHASE-7A4-RANGER-TAXONOMY.md)  
**Primary Modules:** [`src/domain/monsters/taxonomy.js`](../../../src/domain/monsters/taxonomy.js), [`src/domain/combat/knowledge.js`](../../../src/domain/combat/knowledge.js)

---

## 1. 22-Family Monster Taxonomy (`src/domain/monsters/taxonomy.js`)

All **98** documented monsters in SQLite are deterministically classified into the **22** canonical monster families by identity (`LOWER(name)`, `creature_type`, `creature_subtype`), never by blind numeric ID assumptions:

| Tier | Count | Family Keys |
|---|---|---|
| **Selectable Ranger Families** | `14` | `ANIMALS`, `LUPINE_CANINE_BEASTS`, `AVIAN_CHIMERAS`, `TERRESTRIAL_MAGICAL_BEASTS` (*"Other Magical Beasts"*), `ARACHNIDS`, `VERMIN_INSECTS`, `DANGEROUS_PLANTS`, `DRAGONS_DRAKES`, `GOBLINOIDS`, `ORCS`, `GNOLLS`, `REPTILIAN_HUMANOIDS`, `TROLLS`, `GIANTS` |
| **Reserved Families** | `5` | `FEY`, `AMPHIBIAN_HUMANOIDS`, `MONSTROUS_HUMANOIDS`, `ABERRATIONS`, `SUBTERRANEAN_HUMANOIDS` |
| **Non-Selectable Families** | `2` | `OOZES`, `CONSTRUCTS` |
| **Forbidden Family** | `1` | `UNDEAD` |
| **Total** | **`22`** | **98 / 98 monsters classified (`0` unmatched, `0` ambiguous, `0` duplicates)** |

### Key Taxonomy Verifications (`auditDatabaseMonsterTaxonomy`)
1. **Strict Unknown Monster Guard:** `resolveMonsterFamily(monster, { strict: true })` throws an explicit `UNCLASSIFIED_MONSTER_FAMILY` error rather than silently defaulting an unknown monster to `ANIMALS`.
2. **Geographic Surface vs. Passable Map Reachability:**
   - **Design Taxonomy Geographic Surface (including `RIVER`):** `88` monsters (`10` subterranean/dungeon-only excluded).
   - **SQLite `monster_terrains` Surface Rows (including `RIVER`):** `92` monsters (`6` `DUNGEON`-only monsters).
   - **Currently Passable Map Surface (`is_passable = 1`):** `86` monsters (`6` `RIVER`-only monsters unreachable until river crossings are added).
3. **Undead Count:**
   - Design taxonomy narrative count: `11` Undead.
   - Actual SQLite seeded `Undead` count: `12` Undead (`Mohrg` is also seeded as `Undead`); all `12` are classified into `UNDEAD`.
4. **Monster `#36 Mummy` Preservation:**
   - Located by identity (`LOWER(name) = 'mummy'`) and verified untouched: `base_hp = 45`, `armor_class = 20`, `attack_bonus = 14`, `damage_dice = '1d8+10'`, `challenge_rating = 5`, `solo_level = 5`, `monster_family = 'UNDEAD'`.

---

## 2. INT/WIS Battle Experience System (`src/domain/combat/knowledge.js`)

### 2.1 Mastery Tiers (Per Character, Per Monster Species)
Tracked in `character_monster_knowledge (character_id, monster_id, encounters, victories)`:
- **Unfamiliar:** `0` confirmed victories.
- **Recognized:** `1–2` confirmed victories.
- **Experienced:** `3+` confirmed victories (bonuses hard-cap at `3` victories).

### 2.2 Exact INT (Learned Damage) & WIS (Learned AC) Progression Tables

| Effective Attribute | `0` Victories (Unfamiliar) | `1–2` Victories (Recognized) | `3+` Victories (Experienced) |
|---|---|---|---|
| **INT <= 9** | `-1` Damage *(0 if Class-Familiar)* | `+0` Damage | `+0` Damage |
| **INT 10–11** | `+0` Damage | `+0` Damage | `+0` Damage |
| **INT 12–13** | `+0` Damage | `+0` Damage | `+1` Damage |
| **INT 14–15** | `+0` Damage | `+1` Damage | `+2` Damage |
| **INT 16–17** | `+0` Damage | `+2` Damage | `+3` Damage |
| **INT 18+** | `+0` Damage | `+2` Damage | `+4` Damage |
| **WIS <= 9** | `-1` AC *(0 if Class-Familiar)* | `+0` AC | `+0` AC |
| **WIS 10–11** | `+0` AC | `+0` AC | `+0` AC |
| **WIS 12–13** | `+0` AC | `+0` AC | `+1` AC |
| **WIS 14–15** | `+0` AC | `+1` AC | `+1` AC |
| **WIS 16–17** | `+0` AC | `+1` AC | `+2` AC |
| **WIS 18+** | `+0` AC | `+2` AC | `+3` AC |

- **No Attack Bonus (`OC-5`):** Battle Experience never grants Attack bonus (Attack is governed by BAB, STR/DEX, Weapon Training, Favored Enemy, and Class Knowledge).
- **Beginner Protection:** If `hasClassGeneralKnowledge(hero, monster)` is `true` (Fighter vs martial/humanoid, Ranger vs natural, Cleric vs Undead), the `0`-victory `-1` penalty for `INT <= 9` or `WIS <= 9` is suppressed to `0`.

### 2.3 Encounter Secrecy & Recording Rules
- **Stage 1 (`DISCOVERED`):** Does **not** increment `encounters` or `victories`, and never reveals monster species or knowledge tier in the UI.
- **Stage 2 (`IN_COMBAT` via `startCombat`):** Increments `encounters` by `+1`.
- **Victory (`handleMonsterDefeat`):** Increments `victories` by `+1`. Fleeing or dying never increments `victories`.
