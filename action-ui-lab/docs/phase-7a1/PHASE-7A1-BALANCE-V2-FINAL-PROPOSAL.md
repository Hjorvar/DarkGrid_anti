# DARKGRID — PHASE 7A.1: BALANCE V2 FINAL PROPOSAL (SELF-CONTAINED SPECIFICATION)

> **Status:** Internally Consistent Final Design Proposal Ready for Owner Review.
> Supersedes contradictory rules across Phase 7A documents.

---

## 1. Authoritative Character Creation & Attribute System V2

### 1.1 Comparative Evaluation of Attribute Systems (§3 Requirement)

Phase 7A proposed adding secondary micro-bonuses to odd attribute scores (`+2 HP if CON is odd`, `+1 Init if DEX is odd`, etc.). As proved in Finding **C1** ([PHASE-7A1-CORRECTIONS.md](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/docs/phase-7a1/PHASE-7A1-CORRECTIONS.md#L33-L56)), the odd-`CON` HP bonus causes **negative marginal returns at Level 1** (`CON 13` gives 17 HP for Fighter, while raising `CON` to `14` drops HP to 16 HP).

We evaluated three candidate attribute systems across all scores from `8` to `20`:

| Criterion | Option A: Pathfinder Modifiers + Level-Up Growth (RECOMMENDED) | Option B: Even-Number-Only Allocation | Option C: Phase 7A Odd-Stat Micro-Bonuses |
| :--- | :--- | :--- | :--- |
| **Formula** | $\text{Mod}(S) = \lfloor (S - 10)/2 \rfloor$; `+1` attribute point at Levels 2, 4, 6, 8, 10 | Attributes only increment in `+2` steps (`10, 12, 14, 16`) | $\text{Mod}(S) = \lfloor (S - 10)/2 \rfloor$ + bespoke odd-score sub-rules |
| **Strict Monotonicity ($8 \le S \le 20$)** | **PASS** ($\Delta \text{Perf} \ge 0$ for every $+1$ stat point at every level) | **PASS** | **FAIL** (`CON 11 > 12`, `13 > 14`, `15 > 16` at Level 1) |
| **Cognitive & UI Simplicity** | **HIGH** (1 universal rule already familiar to d20 players) | **MEDIUM** (breaks +1 level-up granularity and +1 racial/item parity) | **LOW** (6 invisible sub-rules requiring extra tooltips and combat checks) |
| **Value of Odd Scores (`13`, `15`)** | **HIGH** (Directly bridges to `+2`/`+3` modifier at Level 2 or Level 4) | **N/A** (Eliminates odd scores) | **ARTIFICIAL** (Forces odd scores to compete with even breakpoints) |

**Decision:** **Adopt Option A.** Because characters now earn **5 level-up attribute points** (at Levels 2, 4, 6, 8, and 10), an odd attribute score at creation (e.g., `STR 15` or `CON 13`) is a natural 1-level investment that unlocks the next even modifier (`16` or `14`) at Level 2. No artificial odd-score sub-bonuses are needed or permitted.

---

### 1.2 Class Base Attribute Arrays & Creation Rules

All three classes start with a **68-point even base array**, receive **4 bonus creation points** (**72 total attribute points**), and obey identical creation constraints in [src/config/index.js](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/src/config/index.js#L24-L66):

| Class | Base STR | Base CON | Base DEX | Base INT | Base WIS | Base CHA | Base Sum | Bonus Points | Total Points |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Fighter** | `14` (`+2`) | `12` (`+1`) | `12` (`+1`) | `10` (`+0`) | `10` (`+0`) | `10` (`+0`) | `68` | `+4` | **`72`** |
| **Ranger** | `12` (`+1`) | `12` (`+1`) | `14` (`+2`) | `10` (`+0`) | `10` (`+0`) | `10` (`+0`) | `68` | `+4` | **`72`** |
| **Cleric** | `12` (`+1`) | `12` (`+1`) | `10` (`+0`) | `10` (`+0`) | `14` (`+2`) | `10` (`+0`) | `68` | `+4` | **`72`** |

*Note on Base Array Normalization:* Compared to Era 1 ([src/config/index.js](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/src/config/index.js#L95-L163)), Ranger (`CON 10, WIS 12` $\to$ `CON 12, WIS 10`) and Cleric (`CON 10, CHA 12` $\to$ `CON 12, CHA 10`) both start with `CON 12` (`+1`), eliminating the Era 1 survivability penalty against Fighter.

#### Creation & Level-Up Constraints
1. **Minimum Attribute Floor at Creation:** **`10` (`+0` modifier)** across all 6 attributes (`minAttributeFloor = 10`, `maxDumpPerAttribute = 2` down to floor `10`). Players can no longer dump `INT` and `CHA` to `8` for `+4` free min-max points.
2. **Maximum Attribute Cap at Creation:** **`16` (`+3` modifier)** (`maxAttributeAtCreation = 16`, `1:1` point cost).
3. **Level-Up Attribute Growth:** Characters gain **`+1` Attribute Point at Levels 2, 4, 6, 8, and 10** (`+5` points total across a career).
4. **Hard Attribute Ceiling (Base + Level-Up):** **`20` (`+5` modifier)** (magical equipment enhancement bonuses may raise effective attributes above `20`).

---

### 1.3 Proportionate Roles for all Six Attributes (Including `INT` and `CHA`)

To prevent `INT` and `CHA` from either being useless trap stats or creating overpowered dominant builds:

| Attribute | Modifier Formula | Primary & Secondary Mechanical Effects in Balance V2 |
| :--- | :---: | :--- |
| **STR** | $\lfloor(\text{STR}-10)/2\rfloor$ | Melee Attack Bonus (`+STR_mod`), 1H Melee Damage (`+STR_mod`), 2H Melee Damage (`+floor(1.5 * STR_mod)`), Composite Bow Damage (`+floor(0.5 * max(0, STR_mod))`). |
| **CON** | $\lfloor(\text{CON}-10)/2\rfloor$ | Hit Points per Level (`ClassBaseHP + CON_mod`), Fortitude Save (`+CON_mod`), Fighter *Second Wind* scaling. |
| **DEX** | $\lfloor(\text{DEX}-10)/2\rfloor$ | Ranged Attack Bonus (`+DEX_mod`), Ranged Base Damage (`+DEX_mod`), Armor Class (`min(DEX_mod, ArmorMaxDex)`), Reflex Save (`+DEX_mod`), Initiative (`+DEX_mod`). |
| **INT** | $\lfloor(\text{INT}-10)/2\rfloor$ | **Tactical Insight:** For each $+1$ `INT_mod` above $0$ (max $+3$):<br>• **`+5%` Combat & Bounty XP** (`Math.round(baseXp * (1 + 0.05 * max(0, INT_mod)))`).<br>• **`+1` Special-Ability Save Bonus** against monster spells, breath weapons, gaze, and poison/disease DCs.<br>• **`+1` Stage 1 Monster Threat & Weakness Identification** (reveals exact monster HP tier and special-ability warning 1 stage earlier). |
| **WIS** | $\lfloor(\text{WIS}-10)/2\rfloor$ | Will Save (`+WIS_mod`), Encounter Detection & Ambush Prevention (`+WIS_mod`), Cleric *Divine Healing* charges (`3 + max(0, WIS_mod)`), Healing amount (`+WIS_mod`), and *Sacred Conduit* scaling. |
| **CHA** | $\lfloor(\text{CHA}-10)/2\rfloor$ | **Presence & Resolve:** For each $+1$ `CHA_mod` above $0$ (max $+3$):<br>• **`-5%` City Shop Purchase Price** (min 75% of base price).<br>• **`+5%` Direct Vendor Sell Value** (`Math.floor(buy_price * (0.50 + 0.025 * max(0, CHA_mod)))`, capped at 60% of `buy_price`).<br>• **`+5%` Watcher's Board Bounty Gold Payout**.<br>• **`+1` Resolve AC on Retreat** (`+1 AC` per $+1$ `CHA_mod`, max `+2 AC`, against the monster's parting blow when executing `FLEE`). |

*Dominant-Build Audit:* Investing in `INT` or `CHA` provides meaningful defensive/economic utility (`+1` to `+2` special-ability saves or retreat AC and `+5%–10%` economy efficiency), but never out-scales primary `STR`/`DEX`/`CON`/`WIS` for raw combat DPS or HP.

---

### 1.4 Authoritative Starting Character Specification (Resolving Finding H7)

All contradictions between `10 gp`, `25 gp`, and `180 gp` are resolved into one canonical specification:

| Attribute / Asset | Fighter | Ranger | Cleric |
| :--- | :--- | :--- | :--- |
| **Starting Level / XP** | Level `1` (`0 XP`) | Level `1` (`0 XP`) | Level `1` (`0 XP`) |
| **Starting Gold (`startingGold`)** | **`25 gp`** | **`25 gp`** | **`25 gp`** |
| **Starting Consumables** | `2x Minor Healing Potion` (`2d4+2` HP) | `2x Minor Healing Potion` (`2d4+2` HP) | `2x Minor Healing Potion` (`2d4+2` HP) |
| **Starting Equipped Weapon** | *Shortsword* (`1d6`, `19-20/x2`) | *Shortbow* (`1d6`, `20/x3`, 2H Ranged) | *Heavy Mace* (`1d8` Bludgeoning, `20/x2`) |
| **Starting Equipped Armor** | *Scale Mail* (`+4 AC`, Max DEX `+3`) | *Studded Leather* (`+3 AC`, Max DEX `+4`) | *Scale Mail* (`+4 AC`, Max DEX `+3`) |
| **Starting Equipped Shield** | *Light Wooden Shield* (`+1 AC`) | *Buckler* (`+1 AC`, works with Bow via *Skirmisher Form*) | *Heavy Wooden Shield* (`+2 AC`) |
| **Starting Location** | Oakhaven `(7, 7)` | Oakhaven `(7, 7)` | Oakhaven `(7, 7)` |

---

## 2. Combat Mathematics & Resolution Formulas V2

### 2.1 Hit Points (`MaxHP`)
$$\text{MaxHP}(L) = 4 + L \times (\text{ClassBaseHP} + \text{CON\_mod})$$
- **ClassBaseHP:** Fighter $= 10$, Ranger $= 8$, Cleric $= 8$.
- **Boundary Guarantee:** Since $\text{CON} \ge 10$ ($\text{CON\_mod} \ge 0$), $\Delta \text{HP}/\text{level} \ge 8$ for all classes, and $\partial \text{MaxHP} / \partial \text{CON} \ge 0$ for all $L \ge 1$ and $\text{CON} \in [10, 24]$.

### 2.2 Base Attack Bonus (`BAB`) & Attack Roll
- **Fighter & Ranger (`Full BAB`):** $\text{BAB}(L) = L$ (`+1` at Level 1 to `+10` at Level 10).
- **Cleric (`3/4 BAB`):** $\text{BAB}(L) = 1 + \lfloor (L \times 3) / 4 \rfloor$ (`+1, +2, +3, +4, +4, +5, +6, +7, +7, +8` for Levels 1–10).
- **Hero Attack Bonus:**
  $$\text{ATK}_{\text{hero}} = \text{BAB}(L) + \text{StatMod}_{\text{atk}} + \text{WeaponBonus} + \text{ClassAtkBonus} + \text{StatusAtkMod}$$
  where $\text{StatMod}_{\text{atk}} = \text{STR\_mod}$ for Melee and $\text{DEX\_mod}$ for Ranged.
- **Hit Rule:** Roll $d_{20} \in \{1..20\}$:
  - $d_{20} = 1$: Automatic Miss (`Natural 1`).
  - $d_{20} = 20$: Automatic Hit (`Natural 20`) and triggers a **Critical Threat**.
  - $2 \le d_{20} \le 19$: Hit if and only if $d_{20} + \text{ATK} \ge \text{TargetAC}$.

### 2.3 Critical Threat & Confirmation Roll (Permadeath Spike Protection)
1. **Critical Threat Range:**
   - Hero weapon: `critThreat = weapon.attributes.crit_threat ?? 20` (`20`, `19`, or `18`). A threat occurs if the attack hits and $d_{20} \ge \text{critThreat}$.
   - Monster attack: Threat occurs only on $d_{20} = 20$.
2. **Critical Confirmation Roll:**
   - Roll a second $d_{20}^{\text{conf}} \in \{1..20\}$.
   - The critical hit is **confirmed** if $d_{20}^{\text{conf}} \ne 1$ and $\left(d_{20}^{\text{conf}} = 20 \text{ or } d_{20}^{\text{conf}} + \text{ATK} \ge \text{TargetAC}\right)$.
   - If unconfirmed, the attack still hits for normal (`1x`) damage.
3. **Confirmed Critical Damage Multiplier:**
   - **Hero:** Multiplies weapon + stat/class damage by $\min(3, \text{weapon.crit\_mult ?? } 2)$ (bonus elemental/radiant dice such as *Flaming* `1d6` or Cleric *Sacred Conduit* `1d4` are **not** multiplied on a crit, matching Pathfinder rules).
   - **Monster (Permadeath Protection Rule):**
     - Monsters with `solo_level <= 2`: Confirmed critical multiplies damage by **`1.5x`** ($\lceil \text{rawDamage} \times 1.5 \rceil$).
     - Monsters with `solo_level >= 3`: Confirmed critical multiplies damage by **`2.0x`** ($\text{rawDamage} \times 2$).

### 2.4 Hero Weapon Damage Formulas
- **One-Handed (`1H`) Melee:**
  $$\text{DMG}_{1\text{H}} = \text{WeaponDice} + \text{STR\_mod} + \text{WeaponBonus} + \text{ClassDmgBonus}$$
- **Two-Handed (`2H`) Melee (`is_two_handed === 1`, Melee):**
  $$\text{DMG}_{2\text{H}} = \text{WeaponDice} + \text{STR\_mod} + \lfloor \max(0, \text{STR\_mod}) \times 0.5 \rfloor + \text{WeaponBonus} + \text{ClassDmgBonus}$$
- **Ranged Bow / Crossbow (`Ranged`):**
  $$\text{DMG}_{\text{Ranged}} = \text{WeaponDice} + \text{DEX\_mod} + \lfloor \max(0, \text{STR\_mod}) \times 0.5 \rfloor + \text{WeaponBonus} + \text{ClassDmgBonus}$$
- **Post-DR Clamping:** Final damage after target Damage Reduction (`DR`) is always clamped to $\max(1, \text{rawDamage} - \text{DR})$ on any successful hit.

### 2.5 Armor Class (`AC`) & Damage Reduction (`DR`)
$$\text{AC}_{\text{hero}} = 10 + \text{ArmorAC} + \min(\text{DEX\_mod}, \text{EffectiveMaxDex}) + \text{ShieldAC} + \text{DeflectionAC} + \text{NaturalArmorAC} + \text{ClassACBonus} + \text{StatusACMod}$$
- **Shield & Buckler Rule:**
  - Standard Shields (`Light`/`Heavy`) grant `ShieldAC` only when using a `1H` weapon (`is_two_handed === 0`).
  - *Buckler* (`+1 AC` base, up to `+2 AC` magical) grants its `ShieldAC` while using a `2H` Ranged weapon (`Shortbow`/`Longbow`) with **0 attack penalty** for **Rangers** (*Skirmisher Form*), or `-1 ATK` for non-Rangers.
- **Damage Reduction (`DR`):**
  - Subtracted after each physical attack roll (`finalDamage = Math.max(1, rawDamage - heroDR)`).
  - Fighter *Armor Mastery* grants `DR 1/-` (L3), `DR 2/-` (L6), `DR 3/-` (L9) when wearing Medium/Heavy Armor or a Shield.
  - Stacks with at most `+1` item DR (*Adamantine Breastplate* / *Shield*), hard-capped at `DR 4/-` total.

### 2.6 Deterministic Escape (`FLEE`) & Retreat Defense
- Executing `FLEE` is **always available** (`Permadeath Safety Rule #8`).
- Unless the hero uses a *Smoke Bomb* (which suppresses the parting attack), the monster makes **one parting normal attack** (`freeAttackRoll`, no special abilities or on-hit status effects) against the hero's **Retreat AC**:
  $$\text{AC}_{\text{flee}} = \text{AC}_{\text{hero}} + \text{RangerEvasionBonus} + \min(2, \max(0, \text{CHA\_mod})) + \text{ItemRetreatAC}$$
  where $\text{RangerEvasionBonus} = +2$ (`+3` at Level 6+).
- If the hero survives the parting attack ($\text{HP} > 0$), combat ends immediately with `status = 'ESCAPED'` and the hero retreats to their previous safe tile.

### 2.7 Status Recovery & Anti-Chain-Stun Rule
- Hard crowd-control (`Paralyzed`, `Stunned`) skips **at most 1 hero action**.
- When `Paralyzed` or `Stunned` expires at the end of the hero's skipped action, the engine sets `heroConditions.stunImmunityRounds = 1`.
- During the monster's next attack phase, if `stunImmunityRounds > 0`, the monster **cannot re-apply `Paralyzed` or `Stunned`**, and `stunImmunityRounds` decrements by `1` after that monster turn. This guarantees at least **1 full uninterrupted hero turn** between stuns regardless of who won initiative.

---

## 3. Monster Progression & Coherent World Ecology (All 98 Monsters)

### 3.1 Re-Tiering the 98 Monsters Across Levels 1–10

To eliminate the Level 6–10 content vacuum without inflating low-level monsters, the 98 seeded monsters are distributed across `solo_level` 1–8, with dynamic **Veteran (`+1` Level)** and **Apex/Dire (`+2` Level)** templates populating Levels 9–10:

| Solo Level Tier | Target CR Range | Monster Count | Target HP Range | Target AC Range | Target ATK Bonus | Avg Hit Damage | Representative Monsters |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **Level 1** | `0.25 – 0.5` | `20` | `8 – 16` | `11 – 13` | `+1 to +3` | `3.0 – 5.5` | *Kobold, Giant Rat, Goblin, Skeleton, Zombie, Dire Rat,Stirge, Giant Centipede* |
| **Level 2** | `0.5 – 1.0` | `16` | `16 – 26` | `12 – 14` | `+3 to +5` | `5.0 – 7.5` | *Orc, Hobgoblin, Gnoll, Wolf, Giant Spider, Darkmantle, Drow, Duergar, Giant Crab, Ghoul* |
| **Level 3** | `1.5 – 2.0` | `14` | `26 – 38` | `14 – 15` | `+5 to +7` | `7.0 – 10.0` | *Bugbear, Dire Wolf, Draugr, Harpy, Morlock, Sahuagin, Skeletal Champion, Iron Cobra, Wererat* |
| **Level 4** | `3.0` | `13` | `38 – 52` | `15 – 17` | `+7 to +9` | `9.5 – 13.0` | *Ogre, Wight, Doppelganger, Cockatrice, Ankheg, Assassin Vine, Dire Boar, Shadows* |
| **Level 5** | `4.0` | `12` | `52 – 68` | `16 – 18` | `+9 to +11` | `12.0 – 16.0` | *Owlbear, Gargoyle, Minotaur, Werewolf, Barghest, Bunyip, Giant Scorpion, Hell Hound* |
| **Level 6** | `5.0` | `10` | `68 – 86` | `18 – 19` | `+11 to +13` | `15.0 – 19.5` | *Troll, Wraith, Mummy, Cloaker, Phase Spider, Manticore, Basilisk, Ettin* |
| **Level 7** | `6.0 – 7.0` | `8` | `86 – 108` | `19 – 21` | `+13 to +15` | `18.5 – 24.0` | *Wyvern, Medusa, Chimera, Hill Giant, Spectre, Flesh Golem, Drider, Chaos Beast* |
| **Level 8** | `8.0+` | `5` | `108 – 140` | `20 – 22` | `+15 to +17` | `22.0 – 28.5` | *Hydra, Treant, Shadow Demon, Black Pudding, Young Black Dragon* |
| **Levels 9–10** | `Apex / Dire` | *Dynamic Variants* | `125 – 175` | `21 – 23` | `+16 to +19` | `24.0 – 32.0` | *Elder / Dire / Abyssal variants of Tier 7–8 Monsters & Named Bounties* |

### 3.2 Coherent Ecological Habitat Mapping for the 12 Unspawnable Monsters (§6 Requirement)

We **reject** Phase 7A's proposal to dump underground, desert, and aquatic creatures into generic surface `FOREST`, `HILLS`, or `SWAMP` tiles. Instead, all 12 previously unspawnable monsters (plus `BRIDGE` encounters) are assigned to **ecologically coherent, reachable landmarks and sub-biomes** on the 15x15 world grid:

| Ecological Sub-Biome / Landmark | Reachable Map Coordinates | Assigned Monsters (Preserving World Ecology) |
| :--- | :--- | :--- |
| **Blackwater River Crossing & Old Stone Bridge (`BRIDGE` & Riparian Banks)** | `(8,7)` *The Old Stone Bridge*, `(7,6)`, `(7,8)`, `(9,7)` | **Giant Crab** (L2), **Sahuagin** (L3 *Blackwater River Raider*), *Bunyip* (L5), *Draugr* (L3), *Troll* (L6) |
| **Sunken Crypts, Barrows & Ancient Ruins** | `(4,11)` *Deadman's Mire Crypt*, `(9,7)` *East Watchpost Ruins*, `(11,11)` *Sunken Vault* | **Skeletal Champion** (L3), **Iron Cobra** (L3 *Vault Guardian Construct*), **Doppelganger** (L4), **Mummy** (L6 *Tomb Lord*) |
| **Crag Caverns & Under-Delve Fissures** | `(2,3)` *Raven Crags Cavern*, `(6,4)` *Stonefang Under-Pass*, `(12,3)` *Highland Delve* | **Darkmantle** (L2), **Drow** (L2 *Surface Night-Scout*), **Duergar** (L2 *Deep-Iron Slaver*), **Morlock** (L3), **Cloaker** (L6) |
| **Eldritch Canopy Rift & Deep Jungle** | `(12,12)` *Deep Jungle Rift*, `(2,12)` *Duskwood Veil* | **Phase Spider** (L6), *Chaos Beast* (L7), *Shadow Demon* (L8) |

*Implementation Mechanism:* Add an optional `landmark_tag` / `tile_monster_pools` lookup in `selectMonsterForTile` ([src/domain/encounters/engine.js](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/src/domain/encounters/engine.js#L298-L355)) so these 12 monsters spawn **only** at their ecologically matching landmarks/crossings (or when targeted by a Watcher's Board bounty at those coordinates), ensuring 100% of the 98-monster roster is encounterable with zero ecological dissonance.

---

## 4. XP, Level Progression, Equipment & Economy V2

### 4.1 XP Progression Table & Monster XP Awards

| Level | Cumulative XP Required | Incremental XP ($\Delta\text{XP}$) | Standard Same-Level Monster XP | Expected Same-Level Kills for Level | Cumulative Kills from L1 | Attribute / Class Milestone |
| :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **1** | `0` | — | `100 XP` | — | `0` | Starter Kit, Class Core Passives |
| **2** | `400` | `400` | `150 XP` | `4.0` | `4` | **`+1` Attribute Point** |
| **3** | `1,000` | `600` | `225 XP` | `4.0` | `8` | Class Tier 2 Feature (`DR 1/-`, Doctrine I, Sacred Conduit) |
| **4** | `2,000` | `1,000` | `325 XP` | `4.4` | `12.4` | **`+1` Attribute Point** |
| **5** | `3,600` | `1,600` | `450 XP` | `4.9` | `17.3` | Class Tier 3 Feature (`WT +2`, Evasion, Holy Radiance II) |
| **6** | `6,000` | `2,400` | `600 XP` | `5.3` | `22.6` | **`+1` Attribute Point**, `DR 2/-` |
| **7** | `9,500` | `3,500` | `800 XP` | `5.8` | `28.4` | Lethal Opening Shot `1.0x`, `2/combat` Cleric Heal |
| **8** | `14,500` | `5,000` | `1,050 XP` | `6.3` | `34.7` | **`+1` Attribute Point**, `2/combat` Second Wind |
| **9** | `21,500` | `7,000` | `1,350 XP` | `6.7` | `41.4` | Class Capstone I (`DR 3/-`, Apex Doctrine, Conduit II) |
| **10** | `30,000` | `8,500` | `1,700 XP` | `6.3` | **`47.7` – `55`** | **`+1` Attribute Point**, Level 10 Capstone |

- **Anti-Grind Trivial Monster XP Decay:**
  - If $\text{CharacterLevel} - \text{MonsterSoloLevel} \le 2$: `100%` XP.
  - If $\text{CharacterLevel} - \text{MonsterSoloLevel} = 3$: `50%` XP.
  - If $\text{CharacterLevel} - \text{MonsterSoloLevel} = 4$: `25%` XP.
  - If $\text{CharacterLevel} - \text{MonsterSoloLevel} \ge 5$: `10%` XP (minimum `10 XP`).

### 4.2 Equipment Tiers, Pricing & Active Consumables

1. **Masterwork Tier (Levels 2–4 Bridge in City Shop):**
   - *Masterwork Weapons* (`+1 ATK`, `0 DMG` bonus, non-magical): **`140 gp – 175 gp`**.
   - *Masterwork Armor / Shields* (reduces Armor Check / Initiative penalty by `1`, `+1 AC` on Masterwork Shield): **`150 gp – 220 gp`**.
2. **Magical Enhancement Tiers (Loot, Bounties & Global Market):**
   - **Tier `+1` (Levels 3–5):** Weapons/Armor `+1`, *Ring of Protection +1*, *Amulet of Natural Armor +1*, *Cloak of Resistance +1* (immediately removed from `INACTIVE_ITEM_NAMES`!). Value: **`350 gp – 650 gp`**.
   - **Tier `+2` (Levels 6–8):** Weapons/Armor `+2`, *Belt of Giant Strength +2*, *Gloves of Dexterity +2*, *Periapt of Wisdom +2*, *Boots of Elvenkind* (`+2 Init`, `+2 Retreat AC`). Value: **`1,100 gp – 1,800 gp`**.
   - **Tier `+3` (Levels 8–10):** Weapons/Armor `+3`, *Flaming / Holy* weapons (`+1d6` bonus die, unmultiplied on crit). Value: **`2,600 gp – 4,200 gp`**.
3. **Consumable Activation (Replacing `INACTIVE_CONSUMABLE_NAMES`):**
   - Route both `/game/use-item` and `action-ui-lab`'s `CONSUME_POTION` through `useConsumable()` in [src/domain/character/rules.js](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/src/domain/character/rules.js#L1017-L1092).
   - Implement a **1-Active-Elixir Buff Slot** (`active_buff_json` on `characters`, duration `3 encounters` or until rest):
     - *Antitoxin (`35 gp`):* Clears `Poisoned`/`Diseased` and grants `+4` Fortitude vs Poison for 3 encounters.
     - *Smoke Bomb (`25 gp`, Combat Action):* Immediately triggers `FLEE` while **suppressing the monster's parting attack**.
     - *Potion of Barkskin (`90 gp`):* `+2` Natural Armor AC for 3 encounters.
     - *Potion of Shield of Faith (`90 gp`):* `+2` Deflection AC for 3 encounters.
     - *Potion of Heroism (`160 gp`):* `+2` Morale bonus to Attack and Saving Throws for 3 encounters.

### 4.3 Economy & Resale Rules (Accounting for Variance & Class Expenses)
- **Vendor Sell Value:** Direct NPC vendor sale pays `Math.floor(buy_price * (0.50 + 0.025 * max(0, CHA_mod)))` (50% base, up to 57.5% at `CHA 16`).
- **Global Resale Market (`market_listings`):** When a player sells a non-consumable magical or masterwork item, it is listed on the global market at **`85%` of `buy_price`** (`Math.ceil(buy_price * 0.85)`), replacing the current `125%` markup in [src/domain/economy/shop.js](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/src/domain/economy/shop.js#L172) so other players can actually afford fallen/sold gear. Cap active listings at `30` items globally (FIFO eviction).
- **Direct Gold Drops:** Increase `GOLD_RANGES_STANDARD` at Levels 1–3 by `+40%` (`3–8 gp` at L1, `8–18 gp` at L2, `15–32 gp` at L3) and allow `ANIMAL`/`VERMIN` encounters to drop **Pelt / Trophy Salvage** auto-valued at `2–6 gp` (L1) to `15–30 gp` (L5) so Beast-hunting Rangers are not gold-starved.

---

## 5. World Safety, Chebyshev Danger Caps & Permadeath Rules

1. **Smooth Chebyshev Distance Danger Caps from Oakhaven `(7,7)`:**
   Replace the cliff at $d = 4$ in `getMaxCrForDistance` ([src/domain/encounters/engine.js](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/src/domain/encounters/engine.js#L18-L27)) with a full 7-ring cap:
   - $d = 1$: `maxSoloLevel = 1` (`maxCr = 0.5`), **0% Ambush Rate** for all characters at Level 1–2.
   - $d = 2$: `maxSoloLevel = 2` (`maxCr = 1.0`).
   - $d = 3$: `maxSoloLevel = 3` (`maxCr = 2.0`).
   - $d = 4$: `maxSoloLevel = 4` (`maxCr = 3.0`).
   - $d = 5$: `maxSoloLevel = 6` (`maxCr = 5.0`).
   - $d = 6$: `maxSoloLevel = 7` (`maxCr = 7.0`).
   - $d \ge 7$: `maxSoloLevel = 10` (Uncapped).
2. **Stage 1 Threat Skull Indicator (Respecting Encounter Secrecy):**
   Without revealing the monster's name or exact stats in Stage 1 (`DISCOVERED`), display a **Threat Tier Indicator** based on $\Delta L = \text{MonsterSoloLevel} - \text{CharacterLevel}$:
   - $\Delta L \le 0$: *Standard Sign* (Grey/Amber)
   - $\Delta L = +1$: *Dangerous Presence* (Orange)
   - $\Delta L \ge +2$: *Lethal Threat — Retreat Advised* (Crimson Skull)
3. **Persistent Monster Roadblock Prevention & Identity Preservation:**
   - Keep named persistent monsters (`monster_instances`) and their fallen-hero provenance intact.
   - **Chokepoint Patrol Displacement Rule:** If a persistent monster on a critical chokepoint (*The Old Stone Bridge* `(8,7)` or any $d \le 2$ Oakhaven ring tile) has `solo_level >= CharacterLevel + 2` OR has accumulated `kill_count >= 2`, it **cannot force a Stage 2 Ambush** on a lower-level hero; the hero always enters Stage 1 (`DISCOVERED`) with a free **Skirt the Crossing / Evade** option. Furthermore, after `3` player kills on `(8,7)`, the persistent monster migrates 1 tile to an adjacent bank/watchpost (`(9,7)` or `(7,6)`) as a high-value **Watcher's Board Nemesis Bounty**, clearing the bridge for Level 1–2 travelers while preserving the monster's legend and loot!

---

## 6. Open Decisions Awaiting Owner Approval

The following 5 items are flagged for explicit owner sign-off before Phase 7B code changes begin:

- **`OD-7A1-01` (Attribute System):** Approve **Option A** (Standard Pathfinder modifiers + `+1` attribute point at Levels 2, 4, 6, 8, 10; no odd-stat micro-bonuses).
- **`OD-7A1-02` (Starting Gold):** Approve **`25 gp`** canonical starting gold across production and `action-ui-lab`.
- **`OD-7A1-03` (Cleric Armor Cap):** Approve capping Cleric at **Medium Armor + Shields** so Heavy Armor remains exclusive to Fighter.
- **`OD-7A1-04` (Landmark Ecology Pools):** Approve **Landmark-Scoped Encounter Pools** for the 12 unspawnable monsters (River/Bridge, Sunken Crypts, Crag Caverns, Eldritch Rift).
- **`OD-7A1-05` (Fresh Start Timing & Lifecycle):** Approve the **`ALIVE` / `FALLEN` / `RETIRED`** lifecycle schema and confirm whether Era 1 retirement runs only after Phase 7B simulation gates pass.
