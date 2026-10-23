# DARKGRID — PHASE 7A.3: BATTLE EXPERIENCE (LEARNED ENEMY KNOWLEDGE)

**Date:** 2026-10-22  
**Phase:** 7A.3 — Final Design Corrections, Monster Families & Battle Experience  
**Status:** Authoritative Specification (New System Replacing General `INT` Combat-XP Multiplier)

---

## 1. Design Goal & Core Philosophy

**Battle Experience (Learned Enemy Knowledge)** allows a character to learn how to fight a **specific monster species** (`monster_id`) by **defeating it in combat**.
- **Intelligence (`INT`)** rewards tactical anatomy and pattern study by increasing **damage dealt** against monster species the hero has previously defeated.
- **Wisdom (`WIS`)** rewards battlefield intuition and reading enemy tells by increasing **Armor Class (`AC`)** against monster species the hero has previously defeated.
- **Primary Combat Stats Remain Primary:** `STR`, `DEX`, and `CON` remain the foundational combat attributes for attack accuracy, base damage, initiative, and Hit Points. `INT` and `WIS` do not replace them, but a player who invests heavily in `INT` or `WIS` earns a genuinely impactful combat payoff once they survive and defeat an enemy species.
- **Retires General `INT` Combat-XP Multiplier:** The Phase 6 / Phase 7A.2 rule granting `+10% Combat XP per +1 INT_mod` ([`calculateXpWithIntelligence` in `src/domain/character/rules.js`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/src/domain/character/rules.js#L155-L162)) is **removed**. Intelligence rewards the player with actionable knowledge and learned lethality, not generic XP farming speed.

---

## 2. Victory Tracking & Eligibility Rules

1. **Only Confirmed Victories Count:**
   - A victory is recorded **if and only if** the monster's HP is reduced to `<= 0` and [`handleMonsterDefeat`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/src/domain/monsters/persistence.js#L71-L167) completes.
   - **Fleeing (`FLEE`)** grants **`0`** Battle Experience.
   - **Spotting (`DISCOVERED` / `SURPRISED`)** grants **`0`** Battle Experience.
   - **Investigating (`INVESTIGATE`)** grants **`0`** Battle Experience.
2. **Exact Species Granularity (`monster_id`):**
   - Experience is tracked per exact monster species (`monster_id`, e.g., `#10 Goblin` vs. `#12 Hobgoblin` vs. `#86 Hobgoblin Captain`), **not** across an entire `monster_family`.
3. **One Increment Per Completed Encounter:**
   - Defeating a monster increments `victories` for `(character_id, monster_id)` by exactly **`+1`**, evaluated **after** the victory is confirmed (so the victory that unlocks a milestone applies its bonus starting on the *next* encounter with that species).
4. **Persistent Wounded Monsters & Multi-Encounter Kills:**
   - If Hero A wounds a persistent monster and flees (`FLEE`), no victory is recorded.
   - When that persistent monster is later slain, the `+1` victory is credited to **the hero who lands the killing blow and finishes the encounter**.
5. **Lethal Ranger Opening Shot:**
   - When a Ranger's *Opening Shot* kills a monster before Round 1 (`currentMonsterHp <= 0`), it is a full confirmed victory and increments `victories` by `+1`.
6. **Single-Hero Scope & Permadeath Reset:**
   - Battle Experience belongs strictly to a single `character_id`.
   - When a character dies (`resolvePermadeath`), a newly created character starts with **`0` victories** across all monsters.
   - Victories and milestones persist in SQLite across logout/login, server restarts, and browser reloads.

---

## 3. Experience Milestones & Internal Balance Table

### 3.1 Two Learned Milestones (Hard Cap at 3 Victories)

| Prior Victories (`wins`) | Milestone Tier | Mechanical State |
|---:|---|---|
| **`0` wins** | **Unfamiliar** | No learned bonus. Beginner penalty (`-1 Damage` at `INT 8–9`, `-1 AC` at `WIS 8–9`) applies **unless** the hero has class specialization against this monster. |
| **`1–2` wins** | **Recognized** *(1st Victory)* | Beginner `8–9` penalties vanish permanently for this species. Tier 1 learned `INT` Damage and `WIS` AC bonuses apply. |
| **`3+` wins** | **Experienced** *(3rd Victory)* | Tier 2 learned `INT` Damage and `WIS` AC bonuses apply. **Hard ceiling:** victories beyond `3` (`4, 5, ...`) grant no further stat increase (no endless farming). |

### 3.2 Internal Balance Lookup Table (Simulation & Phase 7B Baseline)

| Effective `INT` / `WIS` Score | `INT` Learned Damage (`0` Wins, No Spec) | `INT` Learned Damage (`1–2` Wins: *Recognized*) | `INT` Learned Damage (`3+` Wins: *Experienced*) | `WIS` Learned AC (`0` Wins, No Spec) | `WIS` Learned AC (`1–2` Wins: *Recognized*) | `WIS` Learned AC (`3+` Wins: *Experienced*) |
|---:|---:|---:|---:|---:|---:|---:|
| **`8–9`** | `-1` *(0 if class spec)* | `0` | `0` | `-1` *(0 if class spec)* | `0` | `0` |
| **`10–11`** | `0` | `0` | `0` | `0` | `0` | `0` |
| **`12–13`** | `0` | `0` | `+1` | `0` | `0` | `+1` |
| **`14–15`** | `0` | `+1` | `+2` | `0` | `+1` | `+1` |
| **`16–17`** | `0` | `+2` | `+3` | `0` | `+1` | `+2` |
| **`18+`** | `0` | `+2` | `+4` | `0` | `+2` | `+3` |

### 3.3 Rules for the `0`-Win Beginner Penalty (`INT 8–9` / `WIS 8–9`)
1. **Unfamiliar Penalty (`wins === 0`):** A character who dumps `INT` to `8–9` suffers `-1 Damage` (total weapon damage still clamped to minimum `1` on a hit) and a character who dumps `WIS` to `8–9` suffers `-1 AC` when fighting a monster species they have **never defeated before** (`wins === 0`).
2. **Immediate Removal After First Win (`wins >= 1`):** As soon as the character defeats that species once (*Recognized*), the `-1` beginner penalty disappears permanently against that species.
3. **Class Specialization Exemption:** Even at `0` wins, the `-1` beginner penalty is **never applied** if the hero possesses automatic class specialization covering that monster:
   - **Fighter (*Know Your Enemy*):** Exempt against all `25` Martial/Humanoid/Giant monsters.
   - **Ranger (*Favored Enemy* & *Natural Knowledge*):** Exempt against their chosen `favored_enemy` family **and** all `52` natural wilderness creatures.
   - **Cleric (*Undead Knowledge*):** Exempt against all `12` `UNDEAD` monsters.
4. **Standard d20 Negative Modifiers Elsewhere:** Outside of Battle Experience, standard Pathfinder-style negative ability modifiers ($\lfloor (8-10)/2 \rfloor = -1$) continue to apply normally to checks that use `INT_mod` or `WIS_mod` (such as Investigation, Awareness/Surprise, and Will saves).

---

## 4. Roles of `INT` and `WIS` Outside Battle Experience

| Attribute | Role Inside Battle Experience | Roles Outside Battle Experience |
|---|---|---|
| **Intelligence (`INT`)** | Learned **Damage bonus** (`0` to `+4`) after `1` and `3` confirmed kills of a monster species; `-1` unfamiliar damage at `INT 8–9`. | **Investigation & Tactical Observation** (`INVESTIGATE` action quality and clue depth), **Trap & Hazard Recognition** (future dungeon/ruin expansion), and lore appraisal. *(General `+10%` combat XP multiplier is removed.)* |
| **Wisdom (`WIS`)** | Learned **Armor Class (`AC`) bonus** (`0` to `+3`) after `1` and `3` confirmed kills of a monster species; `-1` unfamiliar AC at `WIS 8–9`. | **Awareness & Surprise Prevention** (initiative/detection checks), **Will Saving Throws** (resisting `Harpy`, `Green Hag`, `Wraith`, `Gibbering Mouther`), **Danger Detection**, and **Cleric Divine Self-Healing / Sacred Strike**. |

---

## 5. Hidden Mathematics & Player-Facing Narrative

Players never see `+2 Learned Damage` or `+3 Learned AC`. Instead:
1. **Champion Sheet / Compendium Status Badge:** Displays only the qualitative familiarity tier for encountered species: **Unfamiliar**, **Recognized**, or **Experienced**.
2. **Combat Opening Narrative Lines (English Only):**
   - **Class Expertise Only (`0` wins):** *"Years of hunting these creatures give you an instinctive advantage."*
   - **Recognized (`1–2` wins):** *"You remember how this creature fights."*
   - **Experienced (`3+` wins, `INT >= 14` or `WIS >= 14`):** *"You have learned to anticipate its attacks and strike its vital weaknesses."*

---

## 6. SQLite Database & Combat Engine Integration Proposal

### 6.1 Proposed Migration (`db/migrations/009_battle_experience.sql`)
```sql
CREATE TABLE IF NOT EXISTS character_monster_experience (
  character_id INTEGER NOT NULL,
  monster_id INTEGER NOT NULL,
  victories INTEGER NOT NULL DEFAULT 0 CHECK (victories >= 0),
  first_victory_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_victory_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (character_id, monster_id),
  FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
  FOREIGN KEY (monster_id) REFERENCES monsters(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_char_monster_exp_char
  ON character_monster_experience(character_id);
```

### 6.2 Exact Integration Points in Existing Codebase
1. **Query on Combat Start ([`src/domain/combat/engine.js`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/src/domain/combat/engine.js)):**
   - Fetch `victories` for `(character.id, monster.id)` (defaults to `0` if no row exists).
   - Call pure helper `getBattleExperienceBonuses({ intScore, wisScore, victories, hasClassSpecialization })` in [`src/domain/combat/rules.js`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/src/domain/combat/rules.js).
   - Add `learnedDamageBonus` to hero damage rolls (including Ranger *Opening Shot* and Round 1+ attacks) and `learnedAcBonus` to `heroEffectiveAC`.
2. **Increment on Confirmed Victory ([`src/domain/monsters/persistence.js`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/src/domain/monsters/persistence.js#L71-L167)):**
   - Inside the existing SQLite transaction in `handleMonsterDefeat(db, ...)`:
     ```sql
     INSERT INTO character_monster_experience (character_id, monster_id, victories, first_victory_at, last_victory_at)
     VALUES (?, ?, 1, datetime('now'), datetime('now'))
     ON CONFLICT(character_id, monster_id) DO UPDATE SET
       victories = victories + 1,
       last_victory_at = datetime('now');
     ```
   - Because `handleMonsterDefeat` is only called when a monster is actually slain (never on `FLEE` or `INVESTIGATE`), this guarantees 100% atomic consistency across normal kills, persistent monster kills, and lethal Ranger *Opening Shots* (once the `Math.max(1, ...)` bug in `engine.js:238` is fixed in Phase 7B).

---

## 7. Stacking & Synergy Evaluation (Monte Carlo Verification)

Battle Experience stacks additively with class expertise (*Know Your Enemy*, *Favored Enemy*, *Undead Knowledge*). Using `2,000` Monte Carlo trials per matchup, we verified all six required owner balance checks:

| Synergy Test Case | `0` Wins Win Rate | `1` Win (*Recognized*) | `3` Wins (*Experienced*) | Balance Finding |
|---|---:|---:|---:|---|
| **Fighter (`STR 14, INT 18`) vs. `#86 Hobgoblin Captain` (L3)** | `59.4%` (`5.02` rds) | `68.5%` (`4.47` rds) | `75.0%` (`4.02` rds) | **Balanced:** `STR 18` Fighter wins `86.7%` (`0` wins) to `87.2%` (`3` wins). High `INT` starts weaker (`59.4%`) due to lower accuracy/HP and catches up to `75.0%` after 3 kills without surpassing `STR 18`. |
| **Fighter (`STR 14, INT 18, WIS 12`) vs. `#3 Troll` (L5)** | `76.9%` (`8.82` rds) | `88.3%` (`7.17` rds) | `95.9%` (`6.11` rds) | **Balanced:** `STR 16, CON 14` Preset Fighter wins `95.1%` at `0` wins and `97.0%` at `3` wins. `INT 18` cuts fight length from `8.82` to `6.11` rounds after 3 kills (countering Troll regeneration). |
| **Ranger (`DEX 14, INT 18, WIS 12`) vs. Favored `#86 Hobgoblin Captain` (L3)** | `18.8%` (`17.0%` R1 death) | `30.9%` (`2.24` rds) | `44.4%` (`2.16` rds) | **Balanced:** Sacrificing `DEX`/`CON` for `INT 18` makes the Ranger much more fragile at `0` wins (`18.8%` vs Preset `31.9%`), but after 3 kills *Experienced* (`+4 Dmg`) makes the Ranger a deadly ambush glass cannon (`44.4%`). |
| **Cleric (`STR 12, CON 12, WIS 18`) vs. `#49 Wight` (L3 Undead)** | `98.9%` (`5.6` dmg taken) | `98.7%` (`4.8` dmg taken) | `99.2%` (`4.1` dmg taken) | **Balanced:** Cleric already dominates L3 Undead; `WIS 18` learned AC (`+2`/`+3`) reduces average damage taken from `5.6` to `4.1` HP, preserving expedition HP. |
| **Cleric (`STR 12, CON 12, WIS 18, INT 14`) vs. `#31 Owlbear` (L4 Mundane)** | `64.6%` (`35.2` dmg taken) | `82.1%` (`27.7` dmg taken) | `90.3%` (`22.7` dmg taken) | **Healthy Payoff:** A high-`WIS` Cleric struggles on the first Owlbear (`64.6%`), but studying and defeating 3 Owlbears rewards their high `WIS` (`+3 AC`) with `90.3%` survival. |
| **Level 1 Fighter (`STR 18, CON 16, DEX 14, INT 8, WIS 8`) vs. `#2 Wolf` & `#10 Goblin`** | `96.7%` vs Wolf (`0%` R1 death); `100%` vs Goblin | `98.3%` vs Wolf (`2.41` rds) | `98.3%` vs Wolf | **Permadeath Safe:** Dumping `INT 8` & `WIS 8` gives `-1 Dmg / -1 AC` on the first Wolf (`96.7%` win rate, `0%` R1 death) and is exempt on Goblin (*Know Your Enemy*), then clears after 1 win. |

> [!TIP]
> **Owner Balance Recommendation:** The proposed internal table (`INT 18+` = `+2/+4` Dmg, `WIS 18+` = `+2/+3` AC) passes all synergy and anti-dominance checks on the first pass. No silent reductions are needed; we recommend adopting this exact table as the Phase 7B baseline.
