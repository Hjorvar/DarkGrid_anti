# DARKGRID — PHASE 7A.1: CLASS BALANCE & LEVEL 1–10 PROGRESSION TABLES

This document defines the corrected Level 1–10 class progression for **Fighter**, **Ranger**, and **Cleric** under Balance V2, addressing all requirements of Section 4 of the Phase 7A.1 specification.

> **Methodological Note:** All combat parity metrics between classes are design targets to be empirically verified by the Phase 7B.0 Monte Carlo simulation harness ([PHASE-7A1-SIMULATION-GATES.md](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/docs/phase-7a1/PHASE-7A1-SIMULATION-GATES.md)); we do not claim exact class equality prior to simulation execution.

---

## 1. Cross-Class Structural Comparison (Levels 1–10)

| Feature | Fighter (*Armored Vanguard*) | Ranger (*Precision Skirmisher*) | Cleric (*Sacred Bulwark & Conduit*) |
| :--- | :--- | :--- | :--- |
| **Base Attributes (`68` pts + `4` bonus)** | `STR 14, CON 12, DEX 12, INT 10, WIS 10, CHA 10` | `STR 12, CON 12, DEX 14, INT 10, WIS 10, CHA 10` | `STR 12, CON 12, DEX 10, INT 10, WIS 14, CHA 10` |
| **Hit Points per Level** | `10 + CON_mod` (`+4` flat at L1) | `8 + CON_mod` (`+4` flat at L1) | `8 + CON_mod` (`+4` flat at L1) |
| **Base Attack Bonus (`BAB`, L1–L10)** | Full: `+1` to `+10` | Full: `+1` to `+10` | `3/4`: `+1` at L1 to `+8` at L10 |
| **Armor Proficiency** | Light, Medium, **Heavy Armor**, All Shields | Light, Medium Armor, **Buckler (with Bow)** & Light Shield | Light, **Medium Armor**, All Shields (**No Heavy Armor**) |
| **Weapon Proficiency** | All Melee & Ranged Weapons (`1H` & `2H`) | All Melee & Ranged Weapons (Specialized in Bows & Blades) | Blunt/Sacred Weapons (*Maces, Hammers, Flails, Staves, Crossbows*) |
| **Primary Defensive Identity** | Highest AC (`Heavy Armor + Shield`) + Passive `DR 1/-` to `3/-` | Pre-combat damage (*Opening Shot*), High Initiative, `+2/+3` Retreat AC | Mid-combat *Divine Healing*, High Will/Fortitude Saves, Radiant Disruption |
| **Active Combat Ability** | *Second Wind* (Stamina self-heal + +2 AC for 1 round) | *Opening Shot* (Automatic pre-Round-1 ranged strike) | *Divine Healing* / *Channel Radiance* (Heal HP + empower next strike) |
| **Resource Limitation** | `1/combat` (`2/combat` at L8+); no daily charge limit | `1/encounter` (pre-Round-1 only; requires ranged weapon equipped) | Daily Pool: `3 + max(0, WIS_mod)` charges/rest; max `1/combat` (L1–6), `2/combat` (L7–10) |

---

## 2. Fighter — Detailed Review & Level 1–10 Progression

### 2.1 Critical Review of Fighter Survivability (§4.1)
Phase 7A proposed granting Fighter Heavy Armor + Shield (`AC 24–26`), unconditional `DR 1/-` to `DR 4/-`, Weapon Training `+1` to `+3`, and `2/combat` *Second Wind* starting at Level 6.
- **Finding (M1):** Against Level 6–8 monsters that rely on 2–3 physical attacks per round (e.g., *Owlbear*, *Troll*, *Hydra*), stacking `AC 24` with `DR 4/-` and two heals per combat reduces expected net damage taken per fight to near zero, making Fighter virtually unkillable by physical monsters while trivializing potion economy.
- **V2 Correction:**
  1. Cap Fighter passive **Armor Mastery DR** at **`DR 1/-` (L3), `DR 2/-` (L6), `DR 3/-` (L9)**, and require the Fighter to be wearing **Medium or Heavy Armor (or a Shield)** to benefit.
  2. Keep *Second Wind* at **`1/combat` through Level 7**, unlocking a second charge (`2/combat`) only at **Level 8** when facing Tier 7–8 Elite/Apex multi-attackers.
  3. Grant **Two-Handed Power (`1.5x STR_mod`)** on `2H` melee weapons so Fighters have a meaningful choice between **Vanguard (`1H + Shield`, `+2 to +4 AC`)** and **Juggernaut (`2H Greatsword/Greataxe`, `+50% STR damage + higher weapon dice`)**.

### 2.2 Fighter Level 1–10 Progression Table

| Level | BAB | Base HP (`CON 14`) | Passive Abilities | Active Abilities | Level-Up Improvements | Resource Limitations |
| :---: | :---: | :---: | :--- | :--- | :--- | :--- |
| **1** | `+1` | `16` | **Weapon Training I:** `+1` Melee & Ranged Attack.<br>**Martial Proficiencies:** Heavy Armor, Shields, Martial Weapons (`2H` grants `1.5x STR` dmg). | **Second Wind I:** Heal `1d10 + 1 + CON_mod` HP in combat. | Starting Kit + `4` Creation Attribute Points. | *Second Wind:* `1 use / combat`. |
| **2** | `+2` | `28` | **Armor Training I:** Reduces Heavy/Medium Armor DEX cap penalty by `1` (`MaxDEX +1`) and negates `-1` Initiative penalty of Heavy Armor. | *Second Wind I* (`1d10 + 2 + CON_mod`). | **`+1` Attribute Point**.<br>**Bravery I:** `+1` Will Save vs Fear/Aura. | *Second Wind:* `1 use / combat`. |
| **3** | `+3` | `40` | **Armor Mastery I (`DR 1/-`):** Reduces incoming physical hit damage by `1` (min `1`) while wearing Medium/Heavy Armor or a Shield. | *Second Wind I* (`1d10 + 3 + CON_mod`). | **Weapon Training I+:** `+1 ATK, +1 DMG` with all weapons. | *Second Wind:* `1 use / combat`. |
| **4** | `+4` | `52` | *Armor Mastery I (`DR 1/-`)*, *Weapon Training (`+1/+1`)*. | **Second Wind II:** Heals `1d10 + 4 + CON_mod` HP and grants **`+2 AC` for 1 round**. | **`+1` Attribute Point**. | *Second Wind:* `1 use / combat`. |
| **5** | `+5` | `64` | **Weapon Training II:** `+2 ATK, +2 DMG` with all weapons. | *Second Wind II* (`1d10 + 5 + CON_mod`, `+2 AC` 1 rd). | **Bravery II:** `+2` Will Save vs Fear/Aura. | *Second Wind:* `1 use / combat`. |
| **6** | `+6` | `76` | **Armor Mastery II (`DR 2/-`):** Physical damage reduction increases to `2` (min `1` dmg per hit). | *Second Wind II* (`1d10 + 6 + CON_mod`, `+2 AC` 1 rd). | **`+1` Attribute Point**.<br>**Armor Training II:** Heavy Armor `MaxDEX +2`. | *Second Wind:* `1 use / combat`. |
| **7** | `+7` | `88` | **Weapon Training II+:** `+2 ATK, +3 DMG` with all weapons; `+2` Critical Confirmation bonus. | *Second Wind II* (`1d10 + 7 + CON_mod`, `+2 AC` 1 rd). | `+2` bonus on Critical Confirmation rolls. | *Second Wind:* `1 use / combat`. |
| **8** | `+8` | `100` | *Armor Mastery II (`DR 2/-`)*, *Weapon Training (`+2/+3`)*. | **Second Wind III:** Heals `1d10 + 8 + CON_mod` HP (`+2 AC` 1 rd), **2 uses per combat**. | **`+1` Attribute Point**. | *Second Wind:* **`2 uses / combat`** (max `1` per round). |
| **9** | `+9` | `112` | **Armor Mastery III (`DR 3/-`):** Physical damage reduction increases to `3`.<br>**Weapon Training III:** `+3 ATK, +3 DMG`. | *Second Wind III* (`1d10 + 9 + CON_mod`, `+2 AC` 1 rd). | **Bravery III:** `+3` Will Save vs Fear/Aura. | *Second Wind:* `2 uses / combat`. |
| **10** | `+10` | `124` | **Vanguard Capstone:** `+3 ATK, +4 DMG`, `DR 3/-`, immunity to *Shaken/Frightened* on Round 1. | *Second Wind III* (`1d10 + 10 + CON_mod`, `+2 AC` 1 rd). | **`+1` Attribute Point**. | *Second Wind:* `2 uses / combat`. |

---

## 3. Ranger — Detailed Review & Level 1–10 Progression

### 3.1 Critical Review of Ranger Mechanics & Opening Shot State Machine (§4.2)
1. **Opening Shot Lethality & State Safety (Finding H4):**
   - Removing `Math.max(1, ...)` in [src/domain/combat/engine.js](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/src/domain/combat/engine.js#L238) allows *Opening Shot* to kill low-HP monsters before Round 1, which feels rewarding and authentic to the Ranger archetype.
   - To prevent *Opening Shot* from making Ranger overpowered against same-level enemies, *Opening Shot* deals **`0.75x` damage** (`Math.max(1, Math.floor(rawOpeningDamage * 0.75))`) at Levels 1–6, scaling to **`1.0x` damage** at Level 7+.
   - **Mandatory Engine Integration:** When `currentMonsterHp <= 0` after *Opening Shot* in `startCombat()`:
     1. Immediately short-circuit **before** `resolveCombatStartAura()` (dead monsters must not emit Fear/Stench auras) and **before** any monster ambush attack.
     2. Call `handleMonsterDefeat(tx, encounter, character, monster, combatState, rng)` to mark persistent monsters `DEFEATED`, award full XP (`awardEncounterXp`), roll and persist loot (`generateCombatLoot`), update Watcher's Board bounty progress, and set `encounters.status = 'VICTORY'`.
     3. Update `getEncounterById()` ([src/domain/encounters/engine.js](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/src/domain/encounters/engine.js#L494)) so `isRevealed` is `true` when `encounter.status === 'VICTORY'` as well as `'IN_COMBAT'`.
2. **Replacing Narrow Favored Enemy Lock-In with 3 Broad Hunter Doctrines:**
   - Instead of picking 1 of 13 narrow creature types (where `CONSTRUCT` has 0 spawnable targets in Era 1), the Ranger selects a primary **Hunter Doctrine** at Level 1 (granting `+2 ATK, +2 DMG` against that macro-group, scaling to `+3/+3` at L5 and `+4/+4` at L9) and unlocks a **Secondary Doctrine (`+2/+2`)** at Level 5:
     - **Doctrine A — Beasts & Predators (`NATURAL_HUNTER`):** `ANIMAL`, `MAGICAL_BEAST`, `VERMIN`, `PLANT`, `DRAGON` (**46 of 98 monsters — 46.9%**).
     - **Doctrine B — Twisted & Unnatural (`WARDEN_OF_THE_VEIL`):** `UNDEAD`, `ABERRATION`, `OOZE`, `OUTSIDER`, `CONSTRUCT` (**32 of 98 monsters — 32.7%**).
     - **Doctrine C — Brigands & Sentients (`MANHUNTER`):** `HUMANOID`, `MONSTROUS_HUMANOID`, `FEY` (**20 of 98 monsters — 20.4%**, plus `+15%` Watcher's Board Bounty Gold).
   - Against non-Doctrine targets, Ranger still receives baseline **Precision Aim (`+1 ATK, +1 DMG` at L2, `+2/+2` at L6)** so Ranger is never powerless outside their primary doctrine.
3. **Composite Bow & Buckler Balance:**
   - Ranged attacks add `DEX_mod + Math.floor(Math.max(0, STR_mod) * 0.5)` to damage, rewarding Rangers who keep `STR 12–14` (`+1` to `+2` mod) rather than making `STR` dead.
   - Ranger's Level 1 **Skirmisher Form** explicitly permits wearing a *Buckler* (`+1 AC` base, `+2 AC` magical) while firing a two-handed bow with `0` attack penalty, capping Ranger AC 3–4 points below a Shield Fighter while avoiding paper-thin defenses.

### 3.2 Ranger Level 1–10 Progression Table

| Level | BAB | Base HP (`CON 12`) | Passive Abilities | Active / Pre-Combat Abilities | Level-Up Improvements | Resource Limitations |
| :---: | :---: | :---: | :--- | :--- | :--- | :--- |
| **1** | `+1` | `13` | **Hunter Doctrine I:** `+2 ATK, +2 DMG` vs chosen macro-group.<br>**Skirmisher Form:** Buckler AC applies with Bows (`0` ATK penalty); Composite Bow adds `DEX_mod + floor(0.5*STR_mod)` dmg.<br>**Wilderness Scout:** `+2` Initiative & Stage 1 Detection; `+2` Retreat AC on `FLEE`. | **Opening Shot I:** Pre-Round-1 ranged attack before monster acts, dealing `0.75x` normal hit damage (can kill and immediately trigger `VICTORY`). | Starting Kit + `4` Creation Attribute Points + Choice of Primary *Hunter Doctrine*. | *Opening Shot:* `1 / encounter` (automatically fires at combat start if ranged weapon equipped and not ambushed). |
| **2** | `+2` | `22` | **Precision Aim I:** `+1 ATK, +1 DMG` against all enemies (stacks with Hunter Doctrine up to `+2/+2` total at L2). | *Opening Shot I* (`0.75x` dmg, `+1` ATK). | **`+1` Attribute Point**. | *Opening Shot:* `1 / encounter`. |
| **3** | `+3` | `31` | **Trailblazer:** Reduces terrain movement hazard/ambush chance by `50%`; `+1` Reflex & Fortitude saves. | *Opening Shot I* (`0.75x` dmg). | **Doctrine Synergy:** `+1` AC against creatures in Primary Hunter Doctrine. | *Opening Shot:* `1 / encounter`. |
| **4** | `+4` | `40` | **Hunter's Focus:** Critical threat range with Bows and Light/1H Blades expands by `1` (`20 -> 19-20`, `19-20 -> 18-20`). | *Opening Shot I* (`0.75x` dmg). | **`+1` Attribute Point**. | *Opening Shot:* `1 / encounter`. |
| **5** | `+5` | `49` | **Hunter Doctrine II:** Primary Doctrine scales to `+3 ATK, +3 DMG`; unlock **Secondary Hunter Doctrine (`+2 ATK, +2 DMG`)** (covering ~70–80% of all monsters). | *Opening Shot I* (`0.75x` dmg). | Unlock Secondary *Hunter Doctrine*. | *Opening Shot:* `1 / encounter`. |
| **6** | `+6` | `58` | **Precision Aim II:** Baseline bonus increases to `+2 ATK, +2 DMG` vs non-Doctrine targets.<br>**Evasive Retreat II:** Retreat AC bonus on `FLEE` increases to `+3 AC`, and negates Web/Entangle movement penalties. | *Opening Shot I* (`0.75x` dmg). | **`+1` Attribute Point**. | *Opening Shot:* `1 / encounter`. |
| **7** | `+7` | `67` | *Precision Aim II*, *Hunter Doctrine II*. | **Opening Shot II (Lethal Volley):** Pre-Round-1 Opening Shot now deals **full `1.0x` damage** and gains `+2` to hit. | *Opening Shot* scales from `0.75x` to `1.0x` damage. | *Opening Shot:* `1 / encounter`. |
| **8** | `+8` | `76` | **Woodland Stride:** Immunity to `Entangled` condition; `+2` to all Saving Throws vs Poison and Ambush effects. | *Opening Shot II* (`1.0x` dmg, `+2` ATK). | **`+1` Attribute Point**. | *Opening Shot:* `1 / encounter`. |
| **9** | `+9` | `85` | **Hunter Doctrine III:** Primary Doctrine scales to `+4 ATK, +4 DMG`; Secondary Doctrine scales to `+3 ATK, +3 DMG`. | *Opening Shot II* (`1.0x` dmg, `+2` ATK). | `+1` AC vs all Doctrine targets. | *Opening Shot:* `1 / encounter`. |
| **10** | `+10` | `94` | **Master Stalker Capstone:** `+3 ATK, +3 DMG` baseline vs all targets (`+4/+4` vs Primary Doctrine); *Opening Shot* automatically confirms critical threats. | *Opening Shot III* (`1.0x` dmg, `+3` ATK, auto-confirm crits). | **`+1` Attribute Point**. | *Opening Shot:* `1 / encounter`. |

---

## 4. Cleric — Detailed Review & Level 1–10 Progression

### 4.1 Critical Review of Cleric Identity & Survivability (§4.3)
- **Era 1 Problem:** Cleric had `0.75x` BAB (`+0` at L1), `0` general combat passives against the 88% of monsters that are not Undead, and could **only** cast *Divine Self-Heal* out of combat ([src/routes/game.js](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/src/routes/game.js#L520)), resulting in a `~29%` win rate at Levels 4–5.
- **Finding (M2 — Avoiding "Fighter with Better Healing"):**
  - If Cleric is allowed to wear Heavy Armor (Full Plate), wield high-damage weapons, AND cast multiple in-combat heals per fight, Cleric becomes a strictly superior Fighter.
  - **V2 Identity Separation:**
    1. **Armor Boundary:** Cleric is proficient with **Light & Medium Armor + Shields** (capping mundane armor at *Breastplate* `+6 AC`, whereas Fighter wears *Splint/Banded/Full Plate* `+7 to +9 AC` + `DR 1/- to 3/-`).
    2. **Weapon & Sacred Conduit Identity:** Cleric wields Blunt/Sacred weapons (`Mace`, `Morningstar`, `Warhammer`, `Flail`). Through **Sacred Conduit**, Cleric adds `+1` sacred bonus to attack and damage (`+2` at L6), and whenever the Cleric channels **Divine Healing** in combat, their weapon is suffused with divine light for the next `2 rounds`, dealing **`+1d4` Radiant Damage** (`+1d6` at L6+) on hit without sacrificing their entire offensive pressure!
    3. **Per-Combat Healing Cap:** Cleric's daily pool is **`3 + max(0, WIS_mod)` charges per Town Rest**, usable both out of combat and **in combat**. However, in-combat casting is capped at **`1 use / combat` at Levels 1–6** (`2 uses / combat` at Levels 7–10), preventing infinite stall loops while giving Cleric a reliable tactical lifeline.
    4. **Expanded Holy Radiance:** Applies full bonus against `UNDEAD` and **half bonus (rounded up)** against `OUTSIDER` (Fiends/Demons) and `ABERRATION`, broadening its thematic relevance from 12% to **25.5% of the monster roster**.

### 4.2 Cleric Level 1–10 Progression Table

| Level | BAB | Base HP (`CON 12`) | Passive Abilities | Active Abilities (In & Out of Combat) | Level-Up Improvements | Resource Limitations |
| :---: | :---: | :---: | :--- | :--- | :--- | :--- |
| **1** | `+1` | `13` | **Sacred Conduit I:** `+1` Sacred bonus to Attack & Damage with Cleric weapons.<br>**Holy Radiance I:** `+2 ATK, +2 DMG, +1 AC` vs `UNDEAD` (`+1 ATK, +1 DMG, +1 AC` vs `OUTSIDER`/`ABERRATION`).<br>**Cleric Proficiencies:** Light/Medium Armor, All Shields, Blunt Weapons. | **Divine Healing I:** Heal `1d8 + 1 + WIS_mod` HP, clear `Poisoned`/`Diseased`/`Bleeding`, and imbue weapon with **`+1d4` Radiant Damage for 2 rounds**. | Starting Kit + `4` Creation Attribute Points. | **Daily Pool:** `3 + max(0, WIS_mod)` charges per Town Rest.<br>**Combat Limit:** Max `1 use / combat`. |
| **2** | `+2` | `22` | **Aegis of Faith I:** `+1` Sacred bonus to all Saving Throws (`Fortitude`, `Reflex`, `Will`). | *Divine Healing I* (`1d8 + 2 + WIS_mod` HP + `1d4` Radiant for 2 rds). | **`+1` Attribute Point**. | Daily: `3 + WIS_mod`.<br>Combat: `1 / combat`. |
| **3** | `+3` | `31` | **Sacred Conduit I+:** Baseline `+1 ATK, +2 DMG` with Cleric weapons; critical hits always deal `+1d4` bonus Radiant damage. | **Divine Healing II:** Heal `2d6 + 3 + WIS_mod` HP + clears `Sickened`/`Shaken` + `+1d4` Radiant for 2 rds. | *Divine Healing* dice upgrade to `2d6 + L + WIS_mod`. | Daily: `3 + WIS_mod`.<br>Combat: `1 / combat`. |
| **4** | `+4` | `40` | **Sanctified Ward:** `+1` Sacred AC when wearing a Shield or Medium Armor. | *Divine Healing II* (`2d6 + 4 + WIS_mod` HP). | **`+1` Attribute Point**. | Daily: `3 + WIS_mod`.<br>Combat: `1 / combat`. |
| **5** | `+4` | `49` | **Holy Radiance II:** `+3 ATK, +4 DMG, +2 AC` vs `UNDEAD` (`+2 ATK, +2 DMG, +1 AC` vs `OUTSIDER`/`ABERRATION`); negates Undead Energy/Level Drain. | *Divine Healing II* (`2d6 + 5 + WIS_mod` HP). | **Daily Pool +1:** Daily charges increase to `4 + max(0, WIS_mod)`. | Daily: `4 + WIS_mod`.<br>Combat: `1 / combat`. |
| **6** | `+5` | `58` | **Sacred Conduit II:** `+2` Sacred bonus to Attack & Damage with Cleric weapons; post-heal Radiant weapon empowerment increases to **`+1d6` Radiant Damage for 2 rounds**. | **Divine Healing III:** Heal `3d6 + 6 + WIS_mod` HP + **`+1d6` Radiant for 2 rds**. | **`+1` Attribute Point**. | Daily: `4 + WIS_mod`.<br>Combat: `1 / combat`. |
| **7** | `+6` | `67` | **Aegis of Faith II:** `+2` Sacred bonus to all Saving Throws. | *Divine Healing III* (`3d6 + 7 + WIS_mod` HP), now usable **up to `2 times / combat`**. | In-combat healing limit increases to **`2 / combat`**. | Daily: `4 + WIS_mod`.<br>Combat: **`2 / combat`**. |
| **8** | `+7` | `76` | **Divine Resilience:** Reduces incoming necrotic, acid, fire, cold, and breath damage by `3` (`Elemental/Energy Resistance 3`). | *Divine Healing III* (`3d6 + 8 + WIS_mod` HP). | **`+1` Attribute Point**. | Daily: `4 + WIS_mod`.<br>Combat: `2 / combat`. |
| **9** | `+7` | `85` | **Holy Radiance III:** `+4 ATK, +5 DMG, +3 AC` vs `UNDEAD` (`+2 ATK, +3 DMG, +2 AC` vs `OUTSIDER`/`ABERRATION`).<br>**Sacred Conduit II+:** `+2 ATK, +3 DMG` baseline. | **Divine Healing IV:** Heal `4d6 + 9 + WIS_mod` HP + `+1d6` Radiant for 2 rds. | **Daily Pool +1:** Daily charges increase to `5 + max(0, WIS_mod)`. | Daily: `5 + WIS_mod`.<br>Combat: `2 / combat`. |
| **10** | `+8` | `94` | **Avatar of the Vigil Capstone:** `+3` Sacred ATK & DMG baseline; permanent `+1d4` Radiant damage on all weapon hits (`+2d4` for 2 rounds after *Divine Healing*). | *Divine Healing IV* (`4d6 + 10 + WIS_mod` HP). | **`+1` Attribute Point**. | Daily: `5 + WIS_mod`.<br>Combat: `2 / combat`. |
