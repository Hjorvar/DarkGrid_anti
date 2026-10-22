# DARKGRID — PHASE 7A: CLASS BALANCE AUDIT & REDESIGN

## 1. Playable Classes Inventory

Inspection of `src/config/index.js:24-47`, `db/migrations/001_initial_schema.sql:54`, and `src/domain/character/rules.js` confirms there are **three (3)** playable classes in both the original Darkgrid and `action-ui-lab/`:
1. **`FIGHTER`**
2. **`RANGER`**
3. **`CLERIC`**

No additional playable classes exist in the codebase or database schema.

---

## 2. Side-by-Side Class Mechanics Matrix (Verified from Source)

| Mechanic / Parameter | `FIGHTER` | `RANGER` | `CLERIC` | Source Reference |
| :--- | :--- | :--- | :--- | :--- |
| **Base HP per Level** | `10 + CON_mod` | `8 + CON_mod` | `8 + CON_mod` | `character/rules.js:76-83` |
| **Level Attack Bonus** | `level - 1` (`+0` L1 $\to$ `+9` L10) | `level - 1` (`+0` L1 $\to$ `+9` L10) | `floor(level * 0.75)` (`+0` L1 $\to$ `+7` L10) | `character/rules.js:88-96` |
| **Good Saving Throws** | Fortitude (`2 + floor(L/2)`) | Fortitude & Reflex (`2 + floor(L/2)`) | Fortitude & Will (`2 + floor(L/2)`) | `character/rules.js:1101-1118` |
| **Poor Saving Throws** | Reflex & Will (`floor(L/3)`) | Will (`floor(L/3)`) | Reflex (`floor(L/3)`) | `character/rules.js:1101-1118` |
| **Starter Equipment** | Longsword (`1d8`), Shortbow (`1d6`), Chain Shirt (`+4 AC`), Light Steel Shield (`+1 AC`), 2 Minor Healing Potions | Shortsword (`1d6`), Longbow (`1d8`), Leather Armor (`+2 AC`), 2 Minor Healing Potions | Heavy Mace (`1d8`), Sling (`1d4`), Scale Mail (`+5 AC`), Light Steel Shield (`+1 AC`), 2 Minor Healing Potions | `character/rules.js:536-577` |
| **Weapon Access** | All 48 weapons (including 2H Greatsword `2d6`, Greataxe `1d12`, Polearms `1d10`, Heavy Crossbow `1d10`, Longbow `1d8`) | Martial 1H/2H Swords & Axes, Bows (`Longbow +2`, `Oathbow +3`), Crossbows (no Heavy Flail/Polearms/Greatclub/Warhammer/Heavy Mace) | Bludgeoning weapons (`Heavy Mace`, `Morningstar`, `Warhammer`), `Spear`, `Scythe`, `Shortsword`, `Longsword`, `Dagger`, `Light Crossbow`, `Sling`, `Holy Avenger +3` | `db/seeds/005,007,010` (`allowed_classes`) |
| **Armor & Shield Access** | All Light, Medium, Heavy Armor (`Full Plate +2` = `+11 AC`) & All Shields (`Tower Shield` = `+4 AC`, `Heavy Steel Shield +2` = `+4 AC`) | Light Armor (`Chain Shirt +2` = `+6 AC`), selected Medium Armor (`Hide`, `Breastplate +2` = `+8 AC`, `Agile Breastplate`), Light Wooden Shield / Buckler (`+1 AC`) | Light & Medium Armor (`Breastplate +2` = `+8 AC`), Selected Heavy Armor (`Splint Mail`, `Banded Mail` = `+7 AC`, **no Half-Plate or Full Plate**), Shields (`Heavy Steel Shield +2` = `+4 AC`) | `db/seeds/005,007,010` (`allowed_classes`) |
| **Class Passive #1** | **Weapon Training:**<br>• L1–4: `+0 Atk / +0 Dmg`<br>• L5–8: `+1 Atk / +1 Dmg`<br>• L9–10: `+2 Atk / +2 Dmg` | **Favored Enemy (1 Chosen Type):**<br>• L1–4: `+1 Atk / +1 Dmg`<br>• L5–8: `+2 Atk / +2 Dmg`<br>• L9–10: `+3 Atk / +3 Dmg`<br>*(Strictly forbidden vs Undead)* | **Holy Radiance (vs Undead Only):**<br>• L1–4: `+2 Atk / +3 Dmg / +2 AC`<br>• L5–8: `+3 Atk / +4 Dmg / +3 AC`<br>• L9–10: `+4 Atk / +5 Dmg / +4 AC`<br>• Pierces Incorporeal (`50%` miss bypass) | `character/rules.js:101-194`, `combat/abilities.js:239-243` |
| **Class Passive #2** | **Armor Training (Max DEX Cap Bonus):**<br>• L1–2: `+0`<br>• L3–6: `+1`<br>• L7–10: `+2` | **Keen Senses & Hybrid Bow Damage:**<br>• `+3` bonus on Encounter Perception (`1d20 + WIS_mod + 3`)<br>• Ranged Dmg uses `max(STR_mod, floor(DEX_mod/2))` | **Meditative Self-Heal (Out-of-Combat Only):**<br>• L1–2: `1d6+WIS` (2/rest)<br>• L3–4: `2d6+WIS` (2/rest)<br>• L5–6: `3d6+WIS` (3/rest)<br>• L7–8: `4d6+WIS` (3/rest)<br>• L9–10: `5d6+WIS` (4/rest) | `character/rules.js:111-116, 200-258`, `encounters/engine.js:228`, `combat/rules.js:173-177` |
| **Class Active / Combat Special** | None (pure passive stat scaling) | **Opening Shot (Pre-Round 1):**<br>• Free ranged attack on `Investigate` if `spotted_by_hero = 1` and `is_ambush = 0`<br>• **Clamped at 1 HP** (`Math.max(1, hp - dmg)`) | **Divine Power:**<br>• Stubbed in `character/rules.js:200-202` to return `{ attack: 0, damage: 0 }` at all levels! | `combat/engine.js:211-256`, `character/rules.js:200-202` |

---

## 3. Deep-Dive Class Performance Audit

### 3.1 `FIGHTER` — The Reliable Stat Stick (High Floor, Low Tactical Agency)
**Strengths:**
- **Superior Survivability:** Starts with `12–13 HP` (`+20–30%` more than Ranger/Cleric) and gains `+2 HP/level` over both other classes at identical CON.
- **Unmatched Equipment Scaling:** Exclusive access to `Full Plate` (`+9 AC`), `Full Plate +1/+2` (`+10/+11 AC`), `Half-Plate` (`+8 AC`), and `Tower Shield` (`+4 AC`). Combined with *Armor Training* (`+1` Max DEX at L3, `+2` at L7), a Level 5 Fighter in Full Plate +1 + Heavy Steel Shield +1 reaches **AC 26** (`10 + 10 armor + 3 shield + 2 DEX + 1 Ring/Amulet`), where Level 5 monsters (`avg Atk +8.8`) only hit on a roll of `18–20` (`15%` hit rate!).
- **Unconditional Offense:** *Weapon Training* (`+1/+1` at L5, `+2/+2` at L9) applies to **100% of monsters** with both melee and ranged weapons, and 2-handed weapons (`Greatsword` `2d6`) multiply positive `STR_mod` by `1.5x` (`src/domain/combat/rules.js:180`).

**Weaknesses & Design Flaws:**
- **Zero Active Class Identity:** Fighter has no active combat or exploration mechanics—no stances, no second wind, no cleave/power attack choice, and no Weapon Training at Levels 1–4 (`+0/+0`).
- **Vulnerable to Will Saves & Ranged/Flying Harassment Early:** Poor Will save (`+0` at L1–2, often `-1` with `WIS 9`) makes Fighter vulnerable to *Harpy* Captivating Song, *Yellow Musk Creeper* Enthrall, and *Barrow Wight* Dread.

---

### 3.2 `RANGER` — Strong Early Skirmisher with Broken Edge Cases
**Strengths:**
- **Encounter Detection Mastery:** The `+3` Perception bonus (`src/domain/encounters/engine.js:228`) gives a `WIS 10` Ranger a `1d20 + 3` check vs `10 + monster.initiative_bonus` (`avg DC 12.2`). That translates to a **`60%–80%` chance** to spot monsters first, avoiding Ambushes (`is_ambush = 0`) and unlocking *Opening Shot*.
- **Action Economy Advantage via Opening Shot:** When `spotted_by_hero === 1`, Ranger fires a free ranged attack before Round 1 (`src/domain/combat/engine.js:211-256`) and also rolls high Initiative (`1d20 + DEX_mod`, typically `+3` to `+4`), frequently landing **two full attacks before the monster acts once**.
- **Dual Good Saves:** Good Fortitude AND Good Reflex (`character/rules.js:1114-1115`) make Ranger the most resilient class against physical status effects.

**Weaknesses & Design Flaws:**
1. **The Opening Shot 1-HP Clamp (`src/domain/combat/engine.js:238`):**
   ```js
   currentMonsterHp = Math.max(1, currentMonsterHp - openingDamage);
   ```
   Because `investigateEncounter` (`src/domain/encounters/engine.js:294`) calls `initializeCombat()`, which executes `Opening Shot` while transitioning the encounter to `'IN_COMBAT'`, a developer previously clamped `currentMonsterHp` to `1` so the encounter wouldn't end before Round 1!
   - **Impact:** Against Level 1 monsters with `3–6 HP` (*Kobold* 4 HP, *Mite* 4 HP, *Dire Rat* 4 HP, *Human Skeleton* 3 HP, *Giant Centipede* 3 HP, *Stirge* 4 HP), a Ranger's Longbow (`1d8+2` or `1d8+3`, avg `6.5–7.5` dmg) deals enough damage to kill the monster outright on the Opening Shot—yet the monster magically survives at `1 HP`, and if the monster wins the Round 1 initiative roll (e.g., *Goblin* `+6` init, *Human Skeleton* `+6` init, *Stirge* `+4` init), the "dead" 1-HP monster gets a free attack on the Ranger!
   - Note that `src/routes/game.js:393` (`if (result && (result.status === 'VICTORY' || result.monsterDied))`) was actually written to support instant Opening Shot kills, but `engine.js:238` still clamps HP to `1`!
2. **Shield AC Loss While Using Bow (`src/domain/combat/rules.js:33`):**
   - Because all bows (`Shortbow`, `Longbow`) are 2-handed (`isRangedActive = true`), `calculateHeroAC` sets `shieldBonus = 0`. Combined with Light Armor early (`Leather Armor` `+2 AC`), Ranger's AC (`15–16` at L1) is lower than a Shield Fighter (`17 AC`), making prolonged melee trades punishing once the monster closes distance.
3. **Favored Enemy Lock-In Lottery (`src/domain/character/rules.js:122-163`):**
   - A player must pick **one** Favored Enemy at character creation before seeing the world. Look at the actual spawnable monster distribution across the 86 reachable monsters:
     - `MAGICAL BEAST`: 20 reachable monsters (`23.3%`)
     - `ANIMAL`: 12 reachable monsters (`14.0%`)
     - `UNDEAD`: 10 reachable monsters (`11.6%`) — **Forbidden for Ranger!**
     - `ABERRATION`: 7 reachable monsters (`8.1%`)
     - `PLANT`: 6 reachable monsters (`7.0%`)
     - `VERMIN`: 6 reachable monsters (`7.0%`)
     - `MONSTROUS HUMANOID`: 5 reachable monsters (`5.8%`)
     - `HUMANOID:goblinoid`: 4 reachable monsters (`4.7%`)
     - `HUMANOID:reptilian`: 3 reachable monsters (`3.5%`)
     - `DRAGON`: 2 reachable monsters (`2.3%`)
     - `FEY`: 2 reachable monsters (`2.3%`)
     - `HUMANOID:giant`, `gnoll`, `orc`: 2 each (`2.3%`)
     - `OOZE`: 1 reachable monster (`1.2%`)
     - `CONSTRUCT`: **0 reachable monsters (`0.0%`)!** (*Iron Cobra* is unreachable in `["U"]`!)
     - `OUTSIDER`: **0 monsters in database (`0.0%`)!**
   - Allowing a player to select `OUTSIDER` or `CONSTRUCT` at character creation (`ALLOWED_FAVORED_ENEMIES` in `src/domain/character/rules.js:439-443`) when **zero** spawnable monsters of those types exist in the game is a severe design trap.

---

### 3.3 `CLERIC` — Feast vs. Undead, Famine Everywhere Else
**Strengths:**
- **Undead Dominator (*Holy Radiance*):** Against the 10 spawnable Undead monsters, Cleric gains `+2 Atk / +3 Dmg / +2 AC` (L1–4), `+3/+4/+3` (L5–8), and `+4/+5/+4` (L9–10), plus ignores the `50%` Incorporeal miss chance on *Shadow* and *Wraith* (`src/domain/combat/abilities.js:239-243`).
- **Out-of-Combat Sustain (*Meditative Self-Heal*):** 2 to 4 free heals per city rest (`1d6+WIS` up to `5d6+WIS`), saving `50–150 gp` per expedition in healing potions between fights.

**Weaknesses & Critical Balance Failures:**
1. **Severe Combat Deficit Against 88.4% of Spawnable Monsters:**
   - When fighting anything other than Undead (`76` of the `86` reachable monsters), Cleric's `getClericHolyRadianceBonus` returns `{ attack: 0, damage: 0, ac: 0 }` and `getClericDivinePowerBonus` (`src/domain/character/rules.js:200-202`) is a dead stub returning `{ attack: 0, damage: 0 }`!
   - Compare a Level 5 Fighter vs. a Level 5 Cleric against a standard Level 5 non-Undead monster (e.g., *Girallon*, `42 HP, AC 17, Atk +9, Dmg 1d6+6` + Rend):
     - **Level 5 Fighter (STR 18, CON 16, Longsword +1, Full Plate +1, Heavy Shield +1):** `65 HP`, `AC 24`, Attack Bonus `+4 (lvl) + 4 (STR) + 1 (Weapon Training) + 1 (magic) = +10` (`70%` hit vs AC 17), Damage `1d8 + 4 + 1 + 1 = 10.5` avg (`7.35 DPR`). Kills *Girallon* in **~5.7 rounds** while taking `~3.8 DPR` (`~22 HP` lost, **>90% win rate**).
     - **Level 5 Cleric (STR 16, CON 14, Heavy Mace +1, Breastplate +1, Heavy Shield +1):** `50 HP`, `AC 20`, Attack Bonus `+3 (lvl) + 3 (STR) + 0 (class) + 1 (magic) = +7` (`55%` hit vs AC 17), Damage `1d8 + 3 + 0 + 1 = 8.5` avg (`4.68 DPR`). Needs **~9.0 rounds** to kill *Girallon* while taking `~7.8 DPR` (`~70 HP` expected damage vs `50 HP` pool, **<30% win rate without burning multiple expensive potions**!).
2. **Self-Heal Is Blocked in Combat (`src/routes/game.js:520`, `character-town-controller.js:116`):**
   - Cleric's signature healing power cannot be used in combat—only between fights. In a permadeath game where deaths happen inside 4–7 round combat encounters against dangerous foes, out-of-combat healing merely acts as a small gold coupon for `25 gp` Minor Healing Potions while offering **zero** survival value during a lethal fight!
3. **Weapon & Armor Progression Bottleneck:**
   - Cleric is barred from `Full Plate` (`+9 AC`) and `Half-Plate` (`+8 AC`), capping Cleric's mundane chest armor at `Splint Mail` / `Banded Mail` (`+7 AC`), and Cleric has **no +2 Heavy Armor** in `item_definitions` (only `Breastplate +2` at `+8 AC`).
   - Cleric's starting ranged weapon is a `1 gp` **Sling** (`1d4` damage) with `DEX 8` (`-1` to hit), making Cleric's ranged option useless.

---

## 4. Class Balance Redesign Proposals (For Balance V2)

| Class | Feature / Ability | Action | V2 Redesign Specification |
| :--- | :--- | :---: | :--- |
| **`FIGHTER`** | **Base Attack Bonus** | **Rebalance** | Fix Level 1 BAB so Fighter & Ranger use `level` (`+1` at L1 $\to$ `+10` at L10) or `1 + floor((level - 1) * 0.9)` instead of `level - 1` (`+0` at L1). |
| **`FIGHTER`** | **Weapon Training** | **Rebalance** | Smooth progression so it starts earlier: `+1 Atk / +1 Dmg` at **L3–6**, `+2 Atk / +2 Dmg` at **L7–10** (instead of waiting until L5). |
| **`FIGHTER`** | **Armor Training** | **Preserve** | Keep Max DEX bonus increase (`+1` at L3–6, `+2` at L7–10) and add **Armor Mastery DR 1/-** at Level 5+ (`DR 2/-` at Level 9+) when wearing Medium/Heavy armor to counter multi-hit / swarm chip damage. |
| **`FIGHTER`** | **Martial Resolve (New Active/Triggered)** | **Add** | Once per combat (or 2/rest), **Second Wind** as a bonus/free action when dropping below 50% HP (restores `1d8 + level + CON_mod` HP) OR **Guarded Strike** stance (`+2 AC` for 1 round on Attack). |
| **`RANGER`** | **Opening Shot** | **Fix Bug & Rebalance** | **Remove the 1-HP clamp** (`engine.js:238`) so a lethal Opening Shot against a weak creature can score an immediate ambush kill (`VICTORY`), OR if it leaves an Elite/Boss alive, grant `+2 Initiative` on Round 1. |
| **`RANGER`** | **Favored Enemy** | **Redesign** | Replace the 13 narrow/dead categories (which include 0-monster `CONSTRUCT`/`OUTSIDER`) with **3 Broad Hunter Doctrines** chosen at creation (and a 2nd Doctrine unlocked at Level 5):<br>1. **Beasts of the Wild** (`Animal`, `Magical Beast`, `Vermin` — 38 monsters)<br>2. **Foes of Civilization** (`Humanoid` all subtypes, `Monstrous Humanoid`, `Giant` — 23 monsters)<br>3. **Eldritch & Primeval Horrors** (`Aberration`, `Plant`, `Fey`, `Dragon`, `Ooze`, `Construct` — 19 monsters)<br>Bonus: `+1 Atk / +2 Dmg` (L1–4), `+2 Atk / +3 Dmg` (L5–8), `+3 Atk / +4 Dmg` (L9–10). |
| **`RANGER`** | **Ranged Damage Scaling** | **Rebalance** | Replace the trap `max(STR_mod, floor(DEX_mod / 2))` with **agile bow scaling**: `DEX_mod` to Ranged Attack, and `floor(DEX_mod * 0.75) + max(0, floor(STR_mod / 2))` to Ranged Damage, rewarding both pure DEX archers and DEX/STR composite bowmen without dead STR breakpoints. |
| **`CLERIC`** | **Base Attributes** | **Rebalance** | Change Cleric base array from `STR 12, CON 12, DEX 8, INT 10, WIS 14, CHA 12` to **`STR 12, CON 12, DEX 10, INT 10, WIS 14, CHA 10`** (68 pts), removing the forced `-1 DEX` penalty and forced `CHA 12` tax. |
| **`CLERIC`** | **Divine Power (Currently Stubbed at `0/0`)** | **Implement** | Activate `getClericDivinePowerBonus(level, wisdom)` (`character/rules.js:200`) Against **all non-Undead enemies**, grant sacred weapon blessing: `+1 Atk / +1 Dmg` at **L2–4**, `+2 Atk / +2 Dmg` at **L5–7**, `+3 Atk / +3 Dmg` at **L8–10** (scaling with `min(WIS_mod, 3)`). This closes the Level 4–5 Cleric accuracy/damage cliff without overshadowing Fighter. |
| **`CLERIC`** | **Holy Radiance (vs Undead)** | **Rebalance** | Adjust from `+2/+3/+2` (L1–4) to **`+2 Atk / +2 Dmg / +2 AC`** (L1–4), **`+3 Atk / +3 Dmg / +2 AC`** (L5–8), **`+4 Atk / +4 Dmg / +3 AC`** (L9–10) + Incorporeal pierce. |
| **`CLERIC`** | **Divine Self-Heal (Combat + Exploration)** | **Redesign** | Allow Cleric to invoke **Divine Heal** **both in combat (as an action on the combat menu, consuming 1 charge) and out of combat**! In-combat Divine Heal also purges 1 active Poison/Disease/Bleed condition, giving Cleric a distinct, high-survivability tactical identity in permadeath combat. |
