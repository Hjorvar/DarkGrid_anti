# DARKGRID — PHASE 7A: EXPERIENCE, PROGRESSION & ECONOMY AUDIT

## 1. Experience & Leveling Progression Audit

### 1.1 Existing XP Table & Monster XP Rewards (`src/domain/character/rules.js:41-52`, `db/seeds/002..010`)
Darkgrid uses Pathfinder 1e's Fast XP track (`FAST_XP_TABLE`) for Levels 1 through 10:

| Level | Total XP Required | Incremental XP ($\Delta\text{XP}$) | Target Tier Monster XP (`solo_level = min(L, 5)`) | Same-Tier Kills Needed (`INT 10`, `1.0x`) | Same-Tier Kills Needed (`INT 8`, `0.9x`) | Same-Tier Kills Needed (`INT 16`, `1.3x`) |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **1 $\to$ 2** | `1,300` | `1,300` | `100 – 400` (mean `248.6`) | **5.2 kills** (`3.3` CR 1 kills) | 5.8 kills | 4.0 kills |
| **2 $\to$ 3** | `3,300` | `2,000` | `600` | **3.3 kills** | 3.7 kills | 2.6 kills |
| **3 $\to$ 4** | `6,000` | `2,700` | `800` | **3.4 kills** | 3.8 kills | 2.6 kills |
| **4 $\to$ 5** | `10,000` | `4,000` | `1,200` | **3.3 kills** | 3.7 kills | 2.6 kills |
| **5 $\to$ 6** | `15,000` | `5,000` | `1,600` | **3.1 kills** | 3.5 kills | 2.4 kills |
| **6 $\to$ 7** | `23,000` | `8,000` | `1,600` *(Capped at L5!)* | **5.0 kills** *(of L5 monsters)* | 5.6 kills | 3.8 kills |
| **7 $\to$ 8** | `34,000` | `11,000` | `1,600` *(Capped at L5!)* | **6.9 kills** *(of L5 monsters)* | 7.6 kills | 5.3 kills |
| **8 $\to$ 9** | `50,000` | `16,000` | `1,600` *(Capped at L5!)* | **10.0 kills** *(of L5 monsters)* | 11.1 kills | 7.7 kills |
| **9 $\to$ 10** | `71,000` | `21,000` | `1,600` *(Capped at L5!)* | **13.1 kills** *(of L5 monsters)* | 14.6 kills | 10.1 kills |

### 1.2 Critical Progression Pacing Findings
1. **Levels 1 to 5 Are Reached Too Quickly (Only ~15–18 Total Kills):**
   - Look at the incremental XP column above: a character advances from **Level 1 to Level 5 in just ~15.2 average kills** (`5.2 + 3.3 + 3.4 + 3.3`)!
   - Even MORE striking: Level 2 $\to$ 3 (`3.3 kills`), Level 3 $\to$ 4 (`3.4 kills`), Level 4 $\to$ 5 (`3.3 kills`), and Level 5 $\to$ 6 (`3.1 kills`) require **fewer kills per level than Level 1 $\to$ 2 (`5.2 kills`)**!
   - Why? Because monster XP increases by `2.4x` from Level 1 (`248.6` avg) to Level 2 (`600`), while $\Delta\text{XP}$ only increases by `1.54x` (`1,300` $\to$ `2,000`).
2. **Hero Level Outruns Gear Wealth (The "Naked Level 5" Problem):**
   - Because a hero reaches Level 5 after only ~15 kills, let's calculate how much total gold a hero has earned by the time they hit Level 5 (`src/domain/combat/loot.js:15-42`):
     - Base gold per kill: `L1: ~11 gp`, `L2: ~23 gp`, `L3: ~42 gp`, `L4: ~75 gp`.
     - Across 15 kills from Level 1 to Level 5, a hero earns only **`~480 gp` in direct gold drops** (plus `~300–500 gp` in salvaged mundane/treasure drops, minus `~200–300 gp` spent on healing potions).
     - Thus, a hero arrives at **Level 5 with only `~500–700 gp` total net worth**—nowhere near enough to afford a `+1` magic weapon (`2,315 gp`), `+1` armor (`1,200–2,650 gp`), `Ring of Protection +1` (`2,000 gp`), or `Belt of Giant Strength +2` (`4,000 gp`)!
     - As a result, the Gaussian encounter spawner starts throwing Level 4–5 monsters (*Minotaur*, *Girallon*, *Manticore*, *Mummy*) at a Level 4–5 hero who is still wearing mundane Level 2–3 equipment!
3. **No Anti-Grind XP Decay for Trivial Monsters (`src/domain/combat/engine.js:659-670`):**
   - A Level 5 hero killing a Level 1 *Giant Frog* (`11 HP, AC 12`) still receives the full `400 XP` (`25%` of a Level 5 monster's `1,600 XP`) at zero risk.

---

## 2. Equipment System Audit (9 Slots & 113 Items)

### 2.1 Slot-by-Slot Inventory of `item_definitions` (`db/seeds/005,007,010`)
`equipItem` (`src/domain/character/rules.js:737`) supports **9 equipment slots**: `MELEE`, `RANGED`, `ARMOR`, `SHIELD`, `RING`, `CLOAK`, `NECK`, `BELT`, `FEET`.

| Slot | Total Items in DB | Mundane Items (Price Range) | Magical Items (Price Range) | Audit Findings & Structural Issues |
| :--- | :---: | :---: | :---: | :--- |
| **`MELEE`** | 36 | 25 (`0 – 75 gp`) | 11 (`2,302 – 18,000 gp`) | **23x Price Cliff** between best mundane weapon (`Greatsword` 50 gp / `Falchion` 75 gp) and cheapest `+1` weapon (`Dagger +1` 2,302 gp, `Longsword +1` 2,315 gp). No Masterwork (`300 gp`, `+1 Atk`) bridge tier exists! Also, critical threat/multipliers (`19-20/x2`, `20/x3`) are ignored in combat code (`combat/rules.js:256`). |
| **`RANGED`** | 12 | 9 (`1 – 100 gp`) | 5 (`2,330 – 18,000 gp`) | `Composite Shortbow` (`75 gp`, `1d6`) and `Composite Longbow` (`100 gp`, `1d8`) have identical stats in the DB to regular `Shortbow` (`30 gp`, `1d6`) and `Longbow` (`75 gp`, `1d8`). `Light Crossbow` (`35 gp`, `1d8`) and `Heavy Crossbow` (`50 gp`, `1d10`) have no reload penalty, making `Heavy Crossbow` strictly outdamage `Longbow` (`1d8`) for Fighters! |
| **`ARMOR` (`CHEST`)** | 24 | 14 (`5 – 1,500 gp`) | 10 (`1,000 – 5,650 gp`) | Smooth mundane progression (`Leather` 10 gp $\to$ `Chain Shirt` 100 gp $\to$ `Breastplate` 200 gp $\to$ `Half-Plate` 600 gp $\to$ `Full Plate` 1,500 gp). **Bug:** `Bracers of Armor +1` (`1,000 gp`, `equip_slot = 'CHEST'`, `+1 AC`) replaces chest armor with `+1 AC` (worse than `5 gp` Padded Armor!). |
| **`SHIELD` (`OFF_HAND`)** | 9 | 6 (`3 – 30 gp`) | 3 (`1,159 – 4,170 gp`) | `Heavy Wooden Shield` (`7 gp`, `+2 AC`) and `Heavy Steel Shield` (`20 gp`, `+2 AC`) give `+2 AC` for pennies, whereas `Light Steel Shield +1` costs `1,159 gp` for the same `+2 AC`! `Tower Shield` (`30 gp`, `+4 AC`, Max DEX 2) gives massive `+4 AC` at Level 1 for 30 gp with **no `-2` attack penalty** (unlike Pathfinder 1e)! |
| **`RING`** | **1** | 0 | 1 (`Ring of Protection +1`, `2,000 gp`) | Only 1 item in the entire game; grants `+1 AC`. |
| **`NECK`** | **1** | 0 | 1 (`Amulet of Natural Armor +1`, `2,000 gp`) | Only 1 item in the entire game; grants `+1 AC`. |
| **`CLOAK`** | **1** | 0 | 1 (`Cloak of Resistance +1`, `1,000 gp`) | Only 1 item in the entire game; grants `+1` to Fort/Ref/Will saves (`character/rules.js:1122`). |
| **`BELT`** | **1** | 0 | 1 (`Belt of Giant Strength +2`, `4,000 gp`) | Only 1 item in the entire game; grants `+2 STR` (`+1` melee atk/dmg, or `+1` to `+2` 2H dmg). |
| **`FEET`** | **1** | 0 | 1 (`Boots of Elvenkind`, `2,500 gp`) | **Broken Trap Item:** Costs `2,500 gp` and grants **zero mechanical bonuses** (`attributes` states *"Stealth system pending future release"*). |
| **`POTION`** | 13 | 1 (`Antitoxin`, `50 gp`) | 12 (`25 – 1,800 gp`) | Only **6** healing potions work (`Minor Healing` 25 gp [`1d8+1`], `Cure Light` 50 gp [`1d8+1` — identical heal to Minor Healing for 2x price!], `Cure Moderate` 300 gp [`2d8+3`], `Cure Serious` 750 gp [`3d8+5`], `Cure Critical` 1,400 gp [`4d8+7`], `Troll's Blood` 1,800 gp [`5d8+10`]). The other **7 potions** (`INACTIVE_CONSUMABLE_NAMES`) are unimplemented dead items! |
| **`OTHER` (Treasure)** | 14 | 14 (`50 – 5,000 gp`) | 0 | Gems, art objects, and relics (`Uncut Garnet` 50 gp / sell 25 gp up to `Crown of the Sunken King` 5,000 gp / sell 2,500 gp). |

### 2.2 Runaway Armor Class Stacking vs. Monster Accuracy
Look at how AC stacks when a Fighter equips all available defensive slots (`src/domain/combat/rules.js:24-75`):
$$\text{AC} = 10 + \text{ArmorBonus} + \text{ShieldBonus} + \min(\text{DEX\_mod}, \text{MaxDEX}) + \text{RingBonus} + \text{AmuletBonus}$$
- Even with **cheap mundane gear** (`Full Plate` `1,500 gp` [`+9 AC`] + `Tower Shield` `30 gp` [`+4 AC`] + `DEX 14` [`+2` with Armor Training]), a Fighter reaches **AC 25** for just `1,530 gp`!
- With magical gear (`Full Plate +2` [`+11 AC`] + `Heavy Steel Shield +2` [`+4 AC`] + `DEX 14` [`+2`] + `Ring of Protection +1` [`+1`] + `Amulet of Natural Armor +1` [`+1`]), a Fighter reaches **AC 29**!
- Against **AC 25–29**, even Level 5 monsters (`avg Atk +8.8`) need a natural `17–20` (`20%` hit chance) or natural `20` (`5%` hit chance), rendering the Fighter virtually immortal against physical attacks while Ranger (no shield with bow, Light/Medium armor) caps around **AC 20–22**.

---

## 3. Economy, Loot, Shop & Watcher's Board Audit

### 3.1 Gold Faucets (`src/domain/combat/loot.js`, `src/domain/bounties/board.js`)
1. **Combat Gold Drops (`rollMonsterLoot` in `src/domain/combat/loot.js:15-160`):**
   - Base gold roll by `solo_level`:
     - Level 1: `5–18 gp` (mean `11.5 gp`)
     - Level 2: `12–35 gp` (mean `23.5 gp`)
     - Level 3: `25–60 gp` (mean `42.5 gp`)
     - Level 4: `45–105 gp` (mean `75.0 gp`)
     - Level 5: `70–160 gp` (mean `115.0 gp`)
   - Multiplied by `treasure_type` (`None` `0x`, `Incidental` `0.5x`, `Standard` `1.0x`, `Double` `2.0x`, `Triple` `3.0x`) and `loot_tables.gold_multiplier` (`0.7x` Vermin/Undead up to `3.0x` Dragon).
2. **Item Drop Rates (`loot.js:44-55`):**
   - Base item drop chance is `18% + solo_level * 4%` (`22%` at L1 $\to$ `38%` at L5), blended 50/50 with `loot_tables.item_chance` (`25%–80%`), yielding a **`~25%–45%` item drop rate per kill**.
   - **Critical Loot Pool Flaw:** When an item drops from a `loot_table`, `loot_table_entries` can roll **inactive potions** (*Barkskin*, *Bull's Strength*, *Heroism*, etc.) or **useless items** (*Boots of Elvenkind*, *Bracers of Armor +1*)!
3. **Watcher's Board Bounty Rewards (`src/domain/bounties/board.js:88-105`):**
   - Generates 3 hunting contracts per character for monsters of `solo_level` in `[L, L+1]` with a stat boost:
     - `TOUGH`: `+25% HP`, reward `95 * targetLevel + 35` gp (`130 gp` at L1 $\to$ `510 gp` at L5)
     - `AGGRESSIVE`: `+15% HP, +1 Atk`, reward `95 * targetLevel + 50` gp (`145 gp` at L1 $\to$ `525 gp` at L5)
     - `BRUTAL`: `+20% HP, +1 Atk, +1 Dmg`, reward `95 * targetLevel + 65` gp (`160 gp` at L1 $\to$ `540 gp` at L5)
   - **Audit Finding:** Watcher's Board bounties pay **8x to 12x more gold** than a normal monster kill (`145 gp` vs `11.5 gp` at L1) for only a `+15%–25%` HP increase, making bounty contracts by far the most lucrative gold faucet in the early game, yet they grant **zero bonus XP**!

### 3.2 City Shop & Global Resale Market Flaws (`src/domain/economy/shop.js`)
1. **Shop Stocks Every Item up to `buy_price <= 4,500 gp` (`src/domain/economy/shop.js:35-58`):**
   - Oakhaven's general store has infinite stock of almost every `+1` and `+2` magic item, plus all 7 inactive potions (`INACTIVE_CONSUMABLE_NAMES`), `Bracers of Armor +1`, and `Boots of Elvenkind`!
   - **Duplicate Healing Potion Pricing Bug:** `Minor Healing Potion` (`id: 1`, `25 gp`) and `Potion of Cure Light Wounds` (`id: 63`, `50 gp`) both heal the exact same **`1d8+1` HP** (`2–9 HP`), yet `Potion of Cure Light Wounds` costs **twice as much (`50 gp` vs `25 gp`)**!
2. **Global Resale Market Twinking & Price Inconsistency (`src/domain/economy/shop.js:116-195`):**
   - When a character sells a magical item (`is_magical = 1`), they receive `sell_price` (`40%` of `buy_price`), and the item is placed into `market_listings` at `resalePrice = Math.round(sell_price * 1.5)` = **`60%` of base `buy_price`**.
   - **Exploit / Imbalance:** Any new Level 1 character on any account can buy a `+1` magic weapon from `market_listings` for `60%` of retail price (matching the maximum possible `CHA 26` shop discount without investing a single point in `CHA`!), or a wealthy high-level character can intentionally sell items to transfer power to a fresh character.
   - Conversely, when players sell `Minor Healing Potions` (`is_magical = 1`, `buy_price = 25`, `sell_price = 12`), those common potions clutter the global artifact resale market at `18 gp`!
