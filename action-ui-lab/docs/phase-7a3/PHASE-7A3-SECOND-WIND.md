# DARKGRID — PHASE 7A.3: FIGHTER SECOND WIND & LETHAL RESCUE SPECIFICATION

**Date:** 2026-10-22  
**Phase:** 7A.3 — Final Design Corrections, Monster Families & Battle Experience  
**Status:** Authoritative Specification (Updates Fighter Progression in `PHASE-7A2-CLASS-PROGRESSION.md`)

---

## 1. Core Rule: Second Wind with Lethal Rescue

The owner has approved the following core rule for the **Fighter**:

> **Second Wind can save a Fighter from a lethal blow once per combat, provided the ability has not yet been used in that combat.**

In Phase 7A.2, *Second Wind* was specified only to trigger when a Fighter ended a monster hit at `<= 30% Max HP` while still alive (`hp > 0`). Against hard-hitting monsters like `#29 Ogre` (`2d8+7`, critting for up to `46` damage) or `#32 Minotaur` (`3d6+6`), a Fighter at `35%–45% HP` could be dropped straight to `<= 0 HP` in a single blow, dying without *Second Wind* ever firing.

Phase 7A.3 unifies *Second Wind* into a single, deterministic, server-authoritative mechanic with **two activation paths** sharing **one per-combat charge** (`secondWindUsed = false` at combat start):
1. **Critical-HP Recovery Trigger:** After a monster attack sequence or hazard resolves, if `0 < currentHp <= Math.floor(maxHp * 0.30)` and `!secondWindUsed`.
2. **Lethal Rescue Trigger:** When standard HP damage would reduce `currentHp` to `<= 0` and `!secondWindUsed`, the Fighter survives at **`1 HP`**, immediately receives the *Second Wind* heal, and consumes *Second Wind* (`secondWindUsed = true`).

---

## 2. Unlock Level & Level Scaling (Verified Consistency)

We verified the Phase 7A.2 unlock and scaling tiers against the Fighter progression table; no contradiction exists:

| Fighter Level | Ability Tier | Internal Healing Formula (Hidden from Player) | Uses Per Combat | Recharge Rule |
|---:|---|---|---:|---|
| **Levels 1–2** | *Locked* | Not yet unlocked (`secondWindAvailable = false`). | `0` | — |
| **Levels 3–5** | **Second Wind I** | $\text{Heal} = 1\text{d}10 + \text{Level} + M_{\text{con}}$ | `1` | Automatically resets to `Ready` at the start of every new combat encounter. |
| **Levels 6–9** | **Second Wind II** | $\text{Heal} = 2\text{d}10 + \text{Level} + M_{\text{con}}$ | `1` | Automatically resets to `Ready` at the start of every new combat encounter. |
| **Level 10** | **Second Wind III** | $\text{Heal} = 3\text{d}10 + \text{Level} + M_{\text{con}}$ + clears active physical `BLEED` / `STAGGER` | `1` | Automatically resets to `Ready` at the start of every new combat encounter. |

### Exact Healing Math During Lethal Rescue
When **Lethal Rescue** triggers on a blow that would otherwise leave the Fighter at `rawHp <= 0` (e.g., `-9 HP`):
1. The Fighter's HP is first clamped to **`1 HP`** (representing barely surviving the fatal blow through sheer martial grit), **not** healed from negative HP.
2. The *Second Wind* heal roll ($\text{healAmount} = \max(1, \text{dice} + \text{Level} + M_{\text{con}})$) is added to `1 HP`:
   $$\text{newHp} = \min\big(\text{maxHp},\; 1 + \text{healAmount}\big)$$
3. `secondWindUsed` is set to `true` for the remainder of the encounter.
4. Healing can **never** raise `currentHp` above `maxHp`.

---

## 3. Interaction with Every Combat Mechanic & Edge Case

### 3.1 Critical Hits (`20/x2` Monster Crits)
- If a monster lands a critical hit whose post-DR damage would drop the Fighter to `<= 0 HP` while `secondWindUsed === false`, **Lethal Rescue DOES trigger**.
- Protecting the Fighter from sudden single-roll critical-hit spikes (e.g., `#29 Ogre` or `#98 Orc Warchief`) is a primary purpose of Lethal Rescue in a permadeath RPG.

### 3.2 Damage Reduction (`DR`)
- Hero Damage Reduction (from *Armor Mastery* at L8 or protective gear) is subtracted from incoming physical damage **before** HP is reduced and **before** checking *Second Wind* thresholds.
- If `DR` reduces a blow such that `currentHp > Math.floor(maxHp * 0.30)`, *Second Wind* is conserved (`secondWindUsed` remains `false`).

### 3.3 Monster Special Abilities (Multi-Attack `REND`, `ELEMENTAL_RIDER`, `BREATH_WEAPON`, `DEATH_GAZE`)
In [`src/domain/combat/abilities.js`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/src/domain/combat/abilities.js) and [`src/domain/combat/engine.js`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/src/domain/combat/engine.js), a monster's turn can deal damage through multiple components in the same round:
- **Primary Attack + Elemental Rider** (`#28 Ankheg` Acid Bite, `#44 Skeletal Champion` Unholy Strike, `#96 Barrow Wight` Frost Blade).
- **Primary Attack + Multi-Attack `REND`** (`#3 Troll`, `#94 Girallon`).
- **Pre-Attack `BREATH_WEAPON` or `DEATH_GAZE` + Primary Attack** (`#38 Winter Wolf`, `#91 Forest Drake`, `#95 Catoblepas`, `#54 Cloaker`).

**Mandatory Single-Turn Aggregation Rule:**
- To prevent a monster's secondary rider (`REND` or `Acid`) from immediately killing a Fighter in the exact same turn that the primary claw triggered *Second Wind*, **all damage dealt during the monster's offensive action phase in a single round is resolved and summed before checking *Second Wind* / Death**.
- Specifically: if a `#3 Troll` hits with its primary attack (`8` dmg) and triggers `REND` (`9` dmg) for `17` total damage, reducing the Fighter from `12 HP` to `-5 HP`, **Lethal Rescue triggers at the end of the Troll's attack sequence**, clamping the Fighter to `1 HP` and healing `1 + SecondWindHeal`. The Fighter survives the round and enters the next round with `secondWindUsed = true`.

### 3.4 Poison & Damage-Over-Time (`POISON`, `BLEED`, `ACID` DoT Ticks)
- In [`src/domain/combat/engine.js`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/src/domain/combat/engine.js#L368-L410), start-of-round DoT ticks (`POISON`, `BLEED`, `ACID`) apply damage to `currentCharacterHp` at the beginning of the round.
- If a DoT tick reduces the Fighter to `<= 0 HP` (or `<= 30% Max HP`) while `secondWindUsed === false`, **Second Wind / Lethal Rescue DOES trigger** immediately after the DoT tick, keeping the Fighter alive to take their turn!
- At Fighter Level 10 (*Second Wind III*), activation also purges active physical `BLEED` and `STAGGER` conditions.

### 3.5 Non-HP Instant-Death / Petrification Hazards (`CALCIFY`, Supernatural Instant Death)
- **Fighter Is NOT Immune to Non-HP Instant Death:** *Second Wind* is a surge of physical stamina that restores Hit Points; it is **not** a supernatural immunity shield.
- **`CALCIFY` (`#27 Cockatrice` & `#35 Basilisk` Petrifying Bite/Gaze):**
  - When a `Cockatrice` or `Basilisk` applies a 2nd failed Fortitude save stack of `CALCIFY` (`calcifyStacks >= 2`), the character is turned to stone.
  - If the accompanying bite damage was non-lethal (`currentHp > 0`) or lethal, **reaching `2` stacks of `CALCIFY` causes petrification death regardless of *Second Wind***. (*Fighter counters `CALCIFY` through high Constitution and Battle-Hardened Fortitude saves, not through Second Wind.*)
- **Stat Drain / Curse Death (Future Supernatural Effects):** If a future monster kills via `0 Strength` (`Shadow` drain) or an instant-death curse rather than HP loss, *Second Wind* cannot rescue against it.

### 3.6 Death Resolution & Permadeath Handoff
- If `currentHp <= 0` and either:
  1. `character.class !== 'FIGHTER'`, or
  2. `character.level < 3`, or
  3. `combatSession.secondWindUsed === true` (already consumed earlier in this combat), or
  4. Death was caused by a non-HP petrification (`calcifyStacks >= 2`) trigger,
  then death resolution proceeds immediately to [`resolvePermadeath`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/src/domain/monsters/persistence.js#L179-L265): the monster persists on the tile with its `+10% Max HP` trophy boost, the hero's inventory transfers to the monster's loot pool, and the character is permanently marked `is_alive = 0`.

---

## 4. Deterministic 10-Step Combat Engine Trigger Order

To make *Second Wind* and **Lethal Rescue** 100% deterministic and unit-testable in [`src/domain/combat/engine.js`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/src/domain/combat/engine.js), every combat round executes the following exact sequence:

```
STEP 1: Start-of-Round Hero DoT Ticks (Poison / Bleed / Acid)
  └─ Apply DoT damage to currentCharacterHp.
STEP 2: Post-DoT Second Wind / Death Check
  ├─ If currentCharacterHp <= 0:
  │    ├─ If Fighter (L >= 3) AND !secondWindUsed:
  │    │    └─ Trigger LETHAL RESCUE: currentCharacterHp = min(maxHp, 1 + rollSecondWindHeal())
  │    │       secondWindUsed = true; emit SECOND_WIND_LETHAL_RESCUE log event.
  │    └─ Else:
  │         └─ Trigger Permadeath (resolvePermadeath) & terminate round.
  └─ Else if currentCharacterHp <= floor(maxHp * 0.30) AND Fighter (L >= 3) AND !secondWindUsed:
       └─ Trigger CRITICAL HP SECOND WIND: currentCharacterHp = min(maxHp, currentCharacterHp + rollSecondWindHeal())
          secondWindUsed = true; emit SECOND_WIND_RECOVERY log event.

STEP 3: Hero Action Phase (FIGHT / FLEE / POTION)
  └─ Resolve hero attack/damage or potion/flee.
STEP 4: Monster Defeat Check
  └─ If currentMonsterHp <= 0: call handleMonsterDefeat (+1 Battle Experience win) & terminate combat.

STEP 5: Monster Pre-Attack Special Phase (Breath Weapon / Gaze / Fear Aura)
  └─ Accumulate pre-attack HP damage into monsterTurnDamage; resolve saving throws (including CALCIFY stacks).
STEP 6: Monster Primary Attack & Critical Confirmation
  └─ Roll monster d20 vs heroEffectiveAC (including WIS Battle Experience & Know Your Enemy AC).
  └─ Subtract Hero DR from physical hit damage; add to monsterTurnDamage.
STEP 7: Monster On-Hit Riders & Multi-Attack REND
  └─ Resolve Elemental Rider, Poison/Bleed application, Grab/Constrict, or Rend; add HP damage to monsterTurnDamage.
STEP 8: Apply Total Monster Turn Damage
  └─ currentCharacterHp = currentCharacterHp - monsterTurnDamage.

STEP 9: Non-HP Instant-Death Check (Petrification)
  └─ If calcifyStacks >= 2:
       └─ Do NOT trigger Second Wind. Trigger Permadeath ("turned to stone") & terminate round.

STEP 10: End-of-Monster-Turn Second Wind / Lethal Rescue / Permadeath Check
  ├─ If currentCharacterHp <= 0:
  │    ├─ If Fighter (L >= 3) AND !secondWindUsed:
  │    │    └─ Trigger LETHAL RESCUE:
  │    │       currentCharacterHp = min(maxHp, 1 + rollSecondWindHeal())
  │    │       secondWindUsed = true
  │    │       Emit SECOND_WIND_LETHAL_RESCUE narrative & UI state update.
  │    └─ Else:
  │         └─ Trigger Permadeath (resolvePermadeath) & terminate combat.
  └─ Else if currentCharacterHp <= floor(maxHp * 0.30) AND Fighter (L >= 3) AND !secondWindUsed:
       └─ Trigger CRITICAL HP SECOND WIND:
          currentCharacterHp = min(maxHp, currentCharacterHp + rollSecondWindHeal())
          secondWindUsed = true
          Emit SECOND_WIND_RECOVERY narrative & UI state update.
```

---

## 5. Combat Logs & Player Readiness UI

### 5.1 HUD Readiness Indicator
- For a Fighter at Level `3+`, the HUD / combat status bar displays a clear binary indicator:
  - **Ready (`secondWindUsed === false`):** `Second Wind: Ready`
  - **Consumed (`secondWindUsed === true`):** `Second Wind: Spent`
- After *Second Wind* is spent, the player knows with complete certainty that the next lethal blow in that fight will cause permadeath, prompting an informed tactical decision (`FIGHT`, drink a `POTION`, or `FLEE`).

### 5.2 Approved English Combat Log Messages (No Raw Formula Leaks)
- **Critical-HP Trigger (`SECOND_WIND_RECOVERY`):**
  > *"Bloodied and reeling, you draw a deep second wind and steady your stance!"*
- **Lethal Rescue Trigger (`SECOND_WIND_LETHAL_RESCUE`):**
  > *"The blow should have felled you—yet sheer iron will refuses death! Drawing your second wind, you surge back from the brink!"*
