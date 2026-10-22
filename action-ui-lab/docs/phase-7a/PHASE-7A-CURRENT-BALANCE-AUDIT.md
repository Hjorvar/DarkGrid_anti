# DARKGRID — PHASE 7A: CURRENT CHARACTER & ATTRIBUTE BALANCE AUDIT

## 1. Scope & Verified Source Files

This document audits the existing character creation rules, 71-point attribute allocation system, ability modifier math, and derived statistic scaling across levels.

**Authoritative Source References:**
- `src/config/index.js:24-66` — Class base attributes, `startingBonusPoints: 3`, `requiredTotalPoints: 71`, `minStatReductionBelowBase: 2`, `maxStartingStat: 18`, `startingGold: 10`.
- `src/domain/character/rules.js:41-52` — `FAST_XP_TABLE` (Levels 1–10).
- `src/domain/character/rules.js:57-59` — `getModifier(score) = Math.floor((score - 10) / 2)`.
- `src/domain/character/rules.js:76-96` — `getHpPerLevel()` and `getLevelAttackBonus()`.
- `src/domain/character/rules.js:345-415` — `validateCharacterCreation()`.
- `src/domain/character/rules.js:1101-1158` — `getHeroSavingThrows()`, `calculateXpWithIntelligence()`, `calculateShopPriceWithCharisma()`.
- `src/domain/combat/rules.js:24-195` — `calculateHeroAC()`, `calculateHeroAttackBonus()`, `calculateHeroDamage()`.
- `action-ui-lab/server/services/sandbox-db-service.js:162-194` — `CLASS_PRESETS` used in the `action-ui-lab` sandbox.

---

## 2. Audit of the 71-Point Allocation System

### 2.1 Current Class Base Attributes & Allocation Bounds
In `src/config/index.js:24-66`, every class starts with a 68-point base array and receives `3` free bonus points (`requiredTotalPoints = 71`). During creation (`validateCharacterCreation` in `src/domain/character/rules.js:383-404`), each attribute $S_i$ must satisfy:
$$\max(1, \text{Base}_i - 2) \le S_i \le 18 \quad \text{and} \quad \sum_{i=1}^{6} S_i = 71$$

| Attribute | Fighter Base (Min–Max) | Ranger Base (Min–Max) | Cleric Base (Min–Max) |
| :--- | :---: | :---: | :---: |
| **Strength (`STR`)** | 15 (`13–18`) | 12 (`10–18`) | 12 (`10–18`) |
| **Constitution (`CON`)** | 13 (`11–18`) | 12 (`10–18`) | 12 (`10–18`) |
| **Dexterity (`DEX`)** | 10 (`8–18`) | 14 (`12–18`) | 8 (`6–18`) |
| **Intelligence (`INT`)** | 10 (`8–18`) | 10 (`8–18`) | 10 (`8–18`) |
| **Wisdom (`WIS`)** | 10 (`8–18`) | 10 (`8–18`) | 14 (`12–18`) |
| **Charisma (`CHA`)** | 10 (`8–18`) | 10 (`8–18`) | 12 (`10–18`) |
| **Base Sum / Required Total** | **68 / 71** | **68 / 71** | **68 / 71** |

### 2.2 The Odd-Score Dead Zone Flaw
In Darkgrid (`src/domain/character/rules.js:57-59`), every mechanical calculation depends exclusively on the integer ability modifier:
$$\text{Mod}(S) = \left\lfloor \frac{S - 10}{2} \right\rfloor$$
Unlike tabletop Pathfinder 1e—where odd ability scores unlock feats (e.g., *Power Attack* at STR 13), increase carrying capacity per pound, or can be incremented at Levels 4/8/12/16/20—Darkgrid has:
- **Zero** ability score increases on level-up.
- **Zero** feat prerequisites or carrying capacity rules.
- **Only one** stat-boosting item in the entire database (*Belt of Giant Strength +2*, which adds an **even** `+2` to `STR`).

**Consequence:** Every odd attribute score (`7, 9, 11, 13, 15, 17`) is a **100% dead point**—mechanically identical to the even score 1 point below it (`6, 8, 10, 12, 14, 16`).
- Notice that Fighter's default base stats include **two odd numbers** (`STR 15`, `CON 13`). A novice player who puts +1 into STR (`16`), +1 into CON (`14`), and +1 into DEX (`11`) wastes the point in DEX (`11` = `+0` mod).
- Conversely, an optimizer who reduces unused stats by `-2` (`10 -> 8`) never stops on an odd number and harvests up to **+9 usable points** (`+3` bonus points + `3 × 2` dumped points) to hit clean even breakpoints (`18`, `16`, `14`).

---

## 3. Attribute-by-Attribute Mechanical Audit

### 3.1 Summary of Actual Mechanical Effects in Code

| Attribute | Verified Mechanical Effects in Codebase | Scaling / Impact Assessment |
| :--- | :--- | :--- |
| **Strength (`STR`)** | • Melee Attack Bonus: `+STR_mod` (`combat/rules.js:116`)<br>• Melee Damage Bonus: `+STR_mod` (or `+floor(STR_mod * 1.5)` for 2H weapons when `STR_mod > 0`, `combat/rules.js:179-181`)<br>• Ranged Damage Bonus: `+STR_mod` (or `max(STR_mod, floor(DEX_mod / 2))` for Ranger, `combat/rules.js:173-177`) | **S-Tier (Dominant for Melee, Useful for Ranged):** Controls both hit probability and damage per hit. With a 2H weapon (e.g., Greatsword `2d6`), `STR 18` (`+4` mod) grants `+4` to hit and `+6` flat damage per swing (`13.0` avg damage at Level 1!). |
| **Dexterity (`DEX`)** | • Ranged Attack Bonus: `+DEX_mod` (`combat/rules.js:116`)<br>• Ranger Ranged Damage: `floor(DEX_mod / 2)` if `> STR_mod` (`combat/rules.js:175`)<br>• Armor Class: `+DEX_mod` (capped by armor `max_dex_bonus` + Fighter Armor Training, `combat/rules.js:35-61`)<br>• Combat Initiative: `1d20 + DEX_mod` (`combat/engine.js:195`)<br>• Reflex Save: `baseRef + DEX_mod` (`character/rules.js:1131`) | **S-Tier (Dominant for Ranger, High Value for All):** Simultaneously boosts AC, Initiative, Reflex saves, and Ranged accuracy. However, Cleric starts at `DEX 8` (`-1` AC, `-1` Initiative, `-1` Reflex) and Fighter heavy armor caps DEX bonus at `+0` to `+2`. |
| **Constitution (`CON`)** | • Max HP per Level: `(ClassBase + CON_mod) * level` (`character/rules.js:80-83`)<br>• Fortitude Save: `baseFort + CON_mod` (`character/rules.js:1130`) | **S-Tier (Mandatory in Permadeath):** Because CON applies retroactively/multiplicatively at every level, `+2` CON mod (`14`) vs `0` CON mod (`10`) adds `+20%` to `+25%` total HP at all levels, plus Fortitude save defense against Poison, Paralysis, Stunning, and Energy Drain (`abilities.js`). |
| **Wisdom (`WIS`)** | • Will Save: `baseWill + WIS_mod` (`character/rules.js:1132`)<br>• Encounter Perception Check: `1d20 + WIS_mod + (Ranger ? 3 : 0)` vs `10 + monster.initiative_bonus` (`encounters/engine.js:228-232`)<br>• Cleric Self-Heal Bonus: `+WIS_mod` HP per heal charge (`character/rules.js:235`) | **B-Tier (Situational / Class-Specific):** Crucial for avoiding Ambushes (at Level 2+) and triggering Ranger Opening Shot, and resists Will-targeting abilities (*Harpy* song, *Mummy* despair, *Yellow Musk* enthrall). Weak combat scaling for Fighter. |
| **Intelligence (`INT`)** | • Combat XP Multiplier: `max(0.5, 1 + INT_mod * 0.10)` (`character/rules.js:1141-1147`) | **D-Tier (Trap Stat):** Has **zero** effect on combat survival, accuracy, damage, AC, saves, or skills. In a permadeath game, trading `-1` STR/DEX/CON for `+10%` XP increases death probability per level; at max level, `INT` has **zero** effect. |
| **Charisma (`CHA`)** | • City Shop Purchase Price Multiplier: `clamp(1 - CHA_mod * 0.05, 0.6, 1.5)` (`character/rules.js:1152-1158`) | **F-Tier (Severe Trap Stat):** Only gives a `5%` discount per `+1` mod on base shop purchases (`shop.js:50`). Does **not** increase sell prices (`shop.js:167`), does **not** discount global resale market items (`shop.js:126`), and does **not** boost Cleric abilities (*Holy Radiance* or *Self-Heal*). |

### 3.2 Structural Class Stat Penalization: Cleric's Forced `CHA 12` & `DEX 8`
Look closely at the base arrays in `src/config/index.js:24-66`:
- **Fighter** and **Ranger** have `INT 10,CHA 10`, allowing both classes to reduce `INT` to `8` and `CHA` to `8` (`16` total points locked in non-combat stats, `55` points available for `STR + CON + DEX + WIS`).
- **Cleric** has `CHA 12` (minimum `10` due to `minStatReductionBelowBase: 2`) and `DEX 8` (minimum `6`). Even if a Cleric dumps `INT` to `8` and `CHA` to `10`, `18` points are locked in `INT + CHA`, leaving only `53` points for `STR + CON + DEX + WIS`—a permanent **-2 stat point penalty** (equivalent to `-1` modifier) compared to Fighter and Ranger!

---

## 4. Derived Statistics Scaling Across Levels (Levels 1–10)

Let us examine how derived statistics scale from Level 1 to Level 10 under the current formulas:

1. **Hit Points (`getHpPerLevel` in `src/domain/character/rules.js:76-83`):**
   $$\text{MaxHP}(\text{level}) = \text{level} \times \max(1, \text{ClassBaseHP} + \text{CON\_mod})$$
   - Fighter (`ClassBaseHP = 10`, `CON 16` = `+3`): `13 HP` at L1 $\to$ `65 HP` at L5 $\to$ `130 HP` at L10.
   - Ranger / Cleric (`ClassBaseHP = 8`, `CON 14` = `+2`): `10 HP` at L1 $\to$ `50 HP` at L5 $\to$ `100 HP` at L10.
   - **Audit Finding:** Linear HP scaling (`10x` growth from L1 to L10) is steep at early levels (`+100%` HP from L1 to L2) and outpaces the monster database after Level 5 because monsters stop at `solo_level = 5` (`avg HP = 41.2`, `avg Dmg = 9.47`).

2. **Level Attack Bonus (`getLevelAttackBonus` in `src/domain/character/rules.js:88-96`):**
   - Fighter / Ranger: $\text{AttackBonus}_{\text{level}} = \text{level} - 1$ (`+0` at L1, `+4` at L5, `+9` at L10).
   - Cleric: $\text{AttackBonus}_{\text{level}} = \lfloor 0.75 \times \text{level} \rfloor$ (`+0` at L1, `+1` at L2, `+2` at L3, `+3` at L4, `+3` at L5, `+7` at L10).
   - **Audit Finding:**
     - At **Level 1**, Fighter (`1 - 1 = 0`), Ranger (`1 - 1 = 0`), and Cleric (`floor(0.75) = 0`) all get **+0** from level! In Pathfinder 1e, full-BAB martial classes (Fighter, Ranger) receive `+1` BAB at Level 1. Depriving Fighter and Ranger of their `+1` BAB at Level 1 reduces their hit rate by 5 percentage points during the most lethal phase of the game.
     - At **Level 4 vs. Level 5**, Cleric gets `+3` at L4 (`floor(3.0) = 3`) and still `+3` at L5 (`floor(3.75) = 3`), stalling Cleric accuracy right when Level 4–5 monster AC jumps to `16.4–17.3`.

3. **Saving Throws (`getHeroSavingThrows` in `src/domain/character/rules.js:1101-1136`):**
   - $\text{GoodSave}(L) = 2 + \lfloor L / 2 \rfloor$ (`+2` at L1, `+4` at L5, `+7` at L10).
   - $\text{PoorSave}(L) = \lfloor L / 3 \rfloor$ (`+0` at L1–2, `+1` at L3–5, `+3` at L10).
   - **Important Interaction with Monster Abilities (`src/domain/combat/abilities.js:75-100`):** Most monster physical effects (Poison, Paralysis, Grab, Trip, Entangle, Acid, Breath Weapons) check `getHeroSaveBonus(character, 'PHYSICAL')`, which uses `Math.max(fort, ref)`! Because `PHYSICAL` takes the **maximum** of Fortitude and Reflex, and **all three classes have Good Fortitude**, Reflex save is almost completely redundant whenever `Fort >= Ref`! Only Will saves (`saveType === 'WILL'`) check `will` independently.

---

## 5. Evaluation of 9 Representative Builds (3 Per Class)

All 9 builds below are 100% legal under `validateCharacterCreation()` (`sum = 71`, each stat within `[base - 2, 18]`).

### 5.1 Fighter Builds (Starter Gear: Longsword `1d8`, Shortbow `1d6`, Chain Shirt `+4 AC`, Light Steel Shield `+1 AC`)

| Build Archetype | STR | CON | DEX | INT | WIS | CHA | L1 HP / L5 HP | L1 AC (1H+Shield / 2H) | L1 Melee Atk / Avg Dmg (1H / 2H Greatsword) | L1 Saves (Fort / Ref / Will) |
| :--- | :-: | :-: | :-: | :-: | :-: | :-: | :---: | :---: | :---: | :---: |
| **F1: Offensive Min-Max (2H Juggernaut)** | **18** (+4) | **16** (+3) | **12** (+1) | **8** (-1) | **9** (-1) | **8** (-1) | 13 / 65 | 16 / 15 | **+4** / 8.5 (1H) or **13.0** (2H) | +5 / +1 / -1 |
| **F2: Defensive Tank (Sword & Board)** | **16** (+3) | **16** (+3) | **14** (+2) | **8** (-1) | **9** (-1) | **8** (-1) | 13 / 65 | **17** / 16 | **+3** / 7.5 (1H) | +5 / +2 / -1 |
| **F3: Balanced / Novice (No Dump Stats)** | **16** (+3) | **14** (+2) | **11** (+0) | **10** (+0) | **10** (+0) | **10** (+0) | 12 / 60 | 15 / 14 | **+3** / 7.5 (1H) | +4 / +0 / +0 |

**Fighter Build Audit:**
- **F1 vs. F3:** By dumping `INT`, `WIS`, and `CHA` to `8/9/8`, **F1** gains `+1 Atk`, `+1.0` (1H) to `+1.5` (2H) damage per hit, `+1 HP/level` (`+5 HP` at L5), and `+1 AC` over the balanced novice build **F3**, at the sole cost of `-10%` XP and `-1` Will save.
- Buying a `50 gp` mundane **Greatsword** (`2d6`, 2-handed) on **F1** boosts average damage per hit from `8.5` (`1d8+4`) to **`13.0`** (`2d6 + floor(4 * 1.5) = 7 + 6`), one-shotting 26 of the 29 Level 1 monsters on an average roll!

### 5.2 Ranger Builds (Starter Gear: Longbow `1d8`, Shortsword `1d6`, Leather Armor `+2 AC`)

| Build Archetype | STR | CON | DEX | INT | WIS | CHA | L1 HP / L5 HP | L1 AC (Ranged) | L1 Bow Atk / Avg Dmg (`1d8 + max(STR, floor(DEX/2))`) | L1 Perception Mod / Saves (F/R/W) |
| :--- | :-: | :-: | :-: | :-: | :-: | :-: | :---: | :---: | :---: | :---: |
| **R1: Sniper Min-Max (DEX/STR Hybrid)** | **16** (+3) | **14** (+2) | **18** (+4) | **8** (-1) | **8** (-1) | **7** (invalid) $\to$ **STR 14, CON 14, DEX 18, INT 8, WIS 9, CHA 8** | 10 / 50 | **16** | **+4** (+5 Fav) / **6.5** (7.5 Fav) | +2 / (+4 / +6 / -1) |
| **R2: Strength-Bow Bruiser** | **16** (+3) | **14** (+2) | **16** (+3) | **8** (-1) | **9** (-1) | **8** (-1) | 10 / 50 | 15 | **+3** (+4 Fav) / **7.5** (8.5 Fav) | +2 / (+4 / +5 / -1) |
| **R3: Scout / Perception Defensive** | **12** (+1) | **14** (+2) | **16** (+3) | **9** (-1) | **12** (+1) | **8** (-1) | 10 / 50 | 15 | **+3** (+4 Fav) / **5.5** (6.5 Fav) | **+4** / (+4 / +5 / +1) |

**Ranger Build Audit:**
- Look at `calculateHeroDamage` (`src/domain/combat/rules.js:173-177`):
  $$\text{RangedDmgMod}_{\text{Ranger}} = \max\left(\text{STR\_mod}, \left\lfloor \frac{\text{DEX\_mod}}{2} \right\rfloor\right)$$
  Because `max()` takes the larger of `STR_mod` and `floor(DEX_mod / 2)` rather than combining or cleanly separating them:
  - In **R1** (`DEX 18` = `+4`, `floor(4/2) = +2`), raising `STR` from `10` (`+0`) to `14` (`+2`) gives **zero additional ranged damage** (`max(2, 2) = 2`)! Those 4 stat points in STR do nothing for ranged combat unless STR reaches `16` (`+3`).
  - Conversely, a Ranger with `STR 10, CON 16, DEX 18, INT 8, WIS 11, CHA 8` gets the exact same `+4 Atk / 1d8+2 Dmg` as a `STR 14, DEX 18` Ranger while gaining `+1 HP/level` (`CON 16`) and `+1 Will/Perception` (`WIS 10`). This non-intuitive `max(strMod, floor(dexMod/2))` formula creates a hidden stat trap for Rangers investing `12–14` in `STR`.

### 5.3 Cleric Builds (Starter Gear: Heavy Mace `1d8`, Sling `1d4`, Scale Mail `+5 AC`, Light Steel Shield `+1 AC`)

| Build Archetype | STR | CON | DEX | INT | WIS | CHA | L1 HP / L5 HP | L1 AC (Melee) | L1 Mace Atk / Avg Dmg (vs Non-Undead / vs Undead) | L1 Self-Heal (`1d6+WIS`, 2/rest) |
| :--- | :-: | :-: | :-: | :-: | :-: | :-: | :---: | :---: | :---: | :---: |
| **C1: Battle Cleric (Melee Min-Max)** | **16** (+3) | **14** (+2) | **10** (+0) | **8** (-1) | **13** (+1) | **10** (+0) | 10 / 50 | **16** | **+3** / 7.5 (Non-Undead)<br>**+5** / 10.5 (Undead) | `1d6+1` (avg 4.5 x2 = 9 HP) |
| **C2: Defensive / Conduit Cleric** | **14** (+2) | **14** (+2) | **10** (+0) | **8** (-1) | **15** (+2) | **10** (+0) | 10 / 50 | **16** | **+2** / 6.5 (Non-Undead)<br>**+4** / 9.5 (Undead) | `1d6+2` (avg 5.5 x2 = 11 HP) |
| **C3: Default / Flavor Cleric** | **12** (+1) | **12** (+1) | **8** (-1) | **10** (+0) | **16** (+3) | **13** (+1) | 9 / 45 | 15 | **+1** / 5.5 (Non-Undead)<br>**+3** / 8.5 (Undead) | `1d6+3` (avg 6.5 x2 = 13 HP) |

**Cleric Build Audit:**
- Look at **C3** (a player who invests their 3 bonus points into Cleric's thematic primary stats `WIS 16` and `CHA 13` while leaving `STR 12, CON 12, DEX 8`):
  - **C3** starts with **9 HP**, **15 AC** (`DEX 8` penalizes Scale Mail + Shield from 16 down to 15), **`+1` Attack Bonus**, and **`5.5` average damage** against all non-Undead monsters.
  - Because Cleric always leaves an odd number somewhere when dumping `INT 8` and `CHA 10` (`71 - 8 - 10 = 53` odd points remaining across `STR + CON + DEX + WIS`), **every optimized Cleric is mathematically forced to waste at least 1 stat point on an odd number** (`13` or `15`)!

---

## 6. Recommendations for Attribute System Redesign (Balance V2 Preview)

1. **Eliminate the Odd-Score Dead Zone & Forced Stat Dump Meta:**
   - Replace the free-dump 71-point system (where players are rewarded for dumping `INT`/`CHA` to 8 and punished for odd numbers) with **Structured Point-Buy / Even-Step or Sub-Modifier Benefits**, OR grant **+1 Attribute Point at Even Levels (Levels 2, 4, 6, 8, 10 = +5 points total)** so odd starting scores become meaningful stepping stones and characters grow organically across levels.
2. **Give Every Attribute a Real Combat & Exploration Role:**
   - **`INT` (Tactical Insight & Alchemy):** In addition to `+8%` XP per `+1` mod, grant **+10% Potion & Consumable Effectiveness per `+1` INT mod** (minimum `0%`) and **+1 Initiative / Trap & Hazard Insight** so `INT` aids survival at all levels (including max level).
   - **`CHA` (Sacred Presence, Command & Willpower):** In addition to `-5%` shop discount and `+5%` **bounty reward bonus** per `+1` CHA mod, tie `CHA_mod` to **Monster Morale / Flee Success (`+5%` flee chance per `+1` CHA mod)** and **Cleric Sacred Conduit / Smite scaling**, and normalize Cleric's base `DEX` to `10` and `CHA` to `10` so Cleric is no longer penalized by 2 wasted points.
   - **Separate `FORT` and `REF` Saves in Monster Abilities:** Replace the umbrella `'PHYSICAL'` save (`max(fort, ref)`) in `abilities.js` with distinct `'FORT'` (Poison, Disease, Paralysis, Stench, Energy Drain) and `'REF'` (Web, Entangle, Breath Weapons, Acid Spit, Trample) saves so both `CON` and `DEX` matter defensively.
