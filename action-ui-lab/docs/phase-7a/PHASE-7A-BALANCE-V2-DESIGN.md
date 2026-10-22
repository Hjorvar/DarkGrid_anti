# DARKGRID — PHASE 7A: COMPLETE BALANCE V2 DESIGN SPECIFICATION

## 1. Design Philosophy & Core Goals of Balance V2

**Darkgrid Balance V2** is a mathematically unified RPG ruleset designed for the next-generation `action-ui-lab/` adventure experience with a clean Level 1 Fresh Start. Every formula below is designed to achieve six core objectives:
1. **No Dead Stats or Trap Builds:** Eliminate odd-score dead zones and make all 6 attributes (`STR`, `CON`, `DEX`, `INT`, `WIS`, `CHA`) contribute to combat survival and exploration.
2. **Three Distinct, Balanced Classes Across All Levels:** Bring `FIGHTER`, `RANGER`, and `CLERIC` within a **$\pm 5\%$ overall survival and effectiveness band** from Level 1 to Level 10 while sharpening their unique tactical identities.
3. **100% Monster Reachability & Cohesive 10-Level Bestiary:** Ensure all 98 monsters can spawn on the world map and rescale monster tiers across **Levels 1 through 10** (or compress hero max level to a tight **Level 1–8** arc with endgame Bosses at Levels 7–8; we specify the full 10-Level curve below so zero existing XP/level schemas break).
4. **Understandable Risk in a Permadeath World:** Eliminate unavoidable 1-round/2-round RNG deaths via Zone Danger Caps, Stage-1 Threat Tier Omens, and a reliable Emergency Retreat / Consumable economy.
5. **Smooth Equipment & Wealth Progression:** Bridge the 23x price gap between mundane (`50 gp`) and `+1` magic weapons (`2,300 gp`) with a **Masterwork Tier (`300–450 gp`)**, activate all 7 inactive potions, and populate all 9 equipment slots across Tiers 1–3.

---

## 2. Character Creation & Attribute System V2

### 2.1 Normalized 68-Point Base Arrays + 4 Creation Points (`Total = 72`)
To eliminate Cleric's forced `-2` point tax and start every class on clean even baselines, all three classes start with a **68-point even base array** and receive **4 free creation points** (`requiredTotalPoints = 72`):
- **Reduction Floor:** Any attribute may be reduced by at most **-2** below its class base, **with a hard minimum of `10` for `INT`, `WIS`, and `CHA`** (or `-1` max reduction to `9` if odd scores are used)—we recommend a **hard floor of `10` on non-primary stats (`minStatReductionBelowBase = 0` on stats starting at 10)** OR limiting total point reductions across all stats to at most **2 points total**.
- **Why?** Raising the dump floor from `8` to `10` (or capping total reductions at 2 points) immediately ends the mandatory "dump INT/CHA/WIS to 8 on every character" min-max meta while giving 4 clean creation points (`+2` modifiers) to customize the hero's build!
- **Creation Ceiling:** Maximum starting attribute at Level 1 is **`16`** (`+3` modifier) instead of `18` (`+4` modifier), with **+1 Attribute Point granted at Levels 2, 4, 6, 8, and 10 (+5 points total across leveling)** so characters can grow their primary stat to `18–20` as they level up AND every odd score (`11, 13, 15, 17`) becomes a direct stepping stone to the next even breakpoint!

| Class | `STR` Base | `CON` Base | `DEX` Base | `INT` Base | `WIS` Base | `CHA` Base | Base Sum | Free Creation Points | Level-Up Points (L2,4,6,8,10) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **`FIGHTER`** | **14** (+2) | **14** (+2) | **10** (+0) | **10** (+0) | **10** (+0) | **10** (+0) | 68 | **+4** (Total **72**) | **+5** (Total **77** at L10) |
| **`RANGER`** | **12** (+1) | **12** (+1) | **14** (+2) | **10** (+0) | **10** (+0) | **10** (+0) | 68 | **+4** (Total **72**) | **+5** (Total **77** at L10) |
| **`CLERIC`** | **12** (+1) | **12** (+1) | **10** (+0) | **10** (+0) | **14** (+2) | **10** (+0) | 68 | **+4** (Total **72**) | **+5** (Total **77** at L10) |

### 2.2 V2 Attribute Formulas & Sub-Modifier Benefits (Zero Dead Odd Scores)
Even between level-ups, an odd attribute score ($S = 2k + 1$) grants a minor secondary benefit so **no point is ever wasted**:
$$\text{Mod}(S) = \left\lfloor \frac{S - 10}{2} \right\rfloor, \quad \text{OddBonus}(S) = (S \bmod 2)$$

| Attribute | Primary Modifier Effect (`Mod(S)`) | Secondary / Odd-Point Effect (`S - 10` per point) |
| :--- | :--- | :--- |
| **`STR`** | `+Mod` Melee Attack; `+Mod` 1H Melee Damage (`+floor(Mod * 1.5)` 2H Melee Damage) | Odd `STR >= 13` grants **+1 Crit Confirm / +1 Max Damage Roll ceiling** on melee strikes. |
| **`CON`** | `+Mod` HP per Level; `+Mod` **Fortitude** Save | Odd `CON >= 11` grants **+2 Flat Starting HP** at Level 1 (smoothing early survivability). |
| **`DEX`** | `+Mod` Ranged Attack; `+Mod` AC (up to Armor Max DEX); `+Mod` Initiative; `+Mod` **Reflex** Save | Odd `DEX >= 11` grants **+2% Flee Success Chance** and **+1 Initiative tiebreaker**. |
| **`INT`** | **+8% Combat & Discovery XP** per `+1 Mod`; **+15% Healing & Buff Potion potency** per `+1 Mod` | Each point of `INT` above 10 (`+5%` per point) increases **Item Drop Identification / Loot Quality Roll** and grants `+1` Lore/Craft discovery check. |
| **`WIS`** | `+Mod` **Will** Save; `+Mod` Encounter Perception (`1d20 + WIS_mod`); `+Mod` Cleric Healing & Divine Power | Odd `WIS >= 11` grants **+1 Perception vs. Ambush** (`spotted_by_hero` threshold). |
| **`CHA`** | **-5% Shop Buy Price** & **+5% Shop Sell Price** per `+1 Mod`; **+8% Watcher Bounty Gold** per `+1 Mod`; **+5% Flee Success** per `+1 Mod` | Each point of `CHA` above 10 adds **+1 HP to Sanctuary Rest Morale Ward** (temporary HP buffer on first encounter after leaving Oakhaven!). |

---

## 3. Class Balance V2 Specification

### 3.1 Derived HP & Base Attack Progression V2
To prevent Level 1 whiff-fests while keeping higher levels bounded:
1. **Starting Level 1 HP Cushion:** Every hero receives a **+4 HP Level-1 Vitality Cushion** at creation:
   $$\text{MaxHP}(L) = 4 + L \times \max(4,\, \text{ClassBaseHP} + \text{CON\_mod}) + 2 \times \mathbb{I}(\text{CON is odd and } \ge 11)$$
   - At Level 1 (`CON 14`), Fighter starts with **`16 HP`** (up from `12–13`) and Ranger/Cleric start with **`14 HP`** (up from `10`), eliminating 1-round/2-round RNG deaths at Level 1 without needing hidden immersion-breaking invulnerability hacks.
2. **Base Attack Bonus (`getLevelAttackBonus` V2):**
   - **`FIGHTER`:** $\text{BAB}(L) = L$ (`+1` at L1 $\to$ `+5` at L5 $\to$ `+10` at L10).
   - **`RANGER`:** $\text{BAB}(L) = L$ (`+1` at L1 $\to$ `+5` at L5 $\to$ `+10` at L10).
   - **`CLERIC`:** $\text{BAB}(L) = 1 + \lfloor (L - 1) \times 0.75 \rfloor$ (`+1` at L1, `+1` at L2, `+2` at L3, `+3` at L4, `+4` at L5 $\to$ `+7` at L10).

### 3.2 Class Abilities V2

#### A. `FIGHTER`
1. **Weapon Training V2:** `+1 Atk / +1 Dmg` at **Levels 3–6**; `+2 Atk / +2 Dmg` at **Levels 7–10** (applies to all melee and ranged weapons).
2. **Armor Training & Heavy Bulwark V2:**
   - Max DEX Bonus in Armor increases by `+1` at **Levels 3–6** and `+2` at **Levels 7–10**.
   - **Armor Damage Reduction (`DR`):** While wearing Medium or Heavy Armor, Fighter gains **DR 1/- at Levels 4–7** and **DR 2/- at Levels 8–10** against physical attacks.
   - **Shield Cap Normalization:** `Tower Shield` (`+4 AC`) applies its authentic Pathfinder **`-2` Attack Penalty** (`combat/rules.js`) so `+2 AC` Heavy Shield remains the balanced sword-and-board choice and Fighter AC does not hit 29 with zero offensive tradeoff.
3. **Second Wind (Active Combat & Exploration Ability — 1/Rest at L1–4, 2/Rest at L5+):**
   - Usable in combat as a **Swift Self-Rally + Attack** (or standalone action): restores `1d8 + level + CON_mod` HP and clears `Shaken`/`Dazed`.

#### B. `RANGER`
1. **Opening Shot V2 (`src/domain/combat/engine.js:211-256`):**
   - **Remove the 1-HP clamp (`Math.max(1, ...)` -> `Math.max(0, ...)`):** If `Opening Shot` reduces `currentMonsterHp` to `0` against a `TRIVIAL` or `STANDARD` monster, the encounter immediately resolves as `'VICTORY'` (`monsterDied = true`), rewarding stealthy scouting! (Against `ELITE` and `BOSS` monsters, Opening Shot deals full damage down to a floor of `25%` of `max_hp` so bosses cannot be one-shot before Round 1).
2. **Agile Bow & Buckler Doctrine V2:**
   - **Ranged Damage Formula:** $\text{RangedDmgMod} = \lfloor 0.75 \times \text{DEX\_mod} \rfloor + \max(0, \lfloor 0.5 \times \text{STR\_mod} \rfloor)$.
   - **Skirmisher's Buckler:** Rangers equipping a `Buckler` (`+1 AC`) or `Light Wooden Shield` (`+1 AC`) **retain their `+1` Shield AC while firing a Bow**, closing the mid-level AC gap between Ranger and Fighter!
3. **Favored Enemy V2 — 3 Broad Hunter Doctrines (No Dead Choices):**
   - Replace the 13 narrow creature types with **3 Broad Hunter Doctrines** (choose 1 at Level 1, unlock a 2nd Doctrine at Level 5):
     1. **Wilderness Predators** (`Animal`, `Magical Beast`, `Vermin` — 41 monsters)
     2. **Warbands & Giants** (`Humanoid` [all subtypes], `Monstrous Humanoid` — 24 monsters)
     3. **Aberrant & Primeval Horrors** (`Aberration`, `Plant`, `Fey`, `Dragon`, `Construct`, `Ooze` — 21 monsters)
   - Bonus against Doctrine targets: **`+1 Atk / +2 Dmg / +1 AC`** (L1–4), **`+2 Atk / +3 Dmg / +1 AC`** (L5–8), **`+3 Atk / +4 Dmg / +2 AC`** (L9–10).

#### C. `CLERIC`
1. **Divine Favor / Sacred Weapon V2 (Replaces dead `getClericDivinePowerBonus` stub in `character/rules.js:200`):**
   - Against **all non-Undead enemies**, Cleric channels wisdom into their weapon, gaining:
     - **Levels 1–2:** `+0 Atk / +1 Sacred Dmg`
     - **Levels 3–5:** `+1 Atk / +2 Sacred Dmg / +1 AC`
     - **Levels 6–8:** `+2 Atk / +3 Sacred Dmg / +1 AC`
     - **Levels 9–10:** `+3 Atk / +4 Sacred Dmg / +2 AC`
   - Against **Undead** (*Holy Radiance V2*): `+2 Atk / +3 Dmg / +2 AC` (L1–4), `+3 Atk / +4 Dmg / +3 AC` (L5–8), `+4 Atk / +5 Dmg / +4 AC` (L9–10) + Incorporeal Pierce.
2. **Combat & Exploration Divine Heal V2:**
   - Cleric's `performClericSelfHeal` (`1d6+WIS` at L1–2 up to `5d6+WIS` at L9–10; `2 + floor(L/3)` charges per Sanctuary Rest) can now be invoked **both out of combat AND as an action in combat** (`CHANNEL_HEAL`), restoring HP and **purging 1 active Poison, Disease, or Bleed effect**!

---

## 4. Monster Re-Tiering & Combat Mathematics V2 (Levels 1–10)

### 4.1 Fixing All 12 Unreachable Monsters & The Bridge Tile (`monster_terrains` V2)
1. **Map All 12 Unreachable Monsters to Existing Passable Biomes + Landmarks:**
   - *Darkmantle*, *Drow*, *Duergar*, *Iron Cobra*, *Morlock*, *Skeletal Champion*, *Doppelganger*, *Cloaker*, *Mummy*, *Phase Spider* (currently restricted to `UNDERGROUND_RUINS` / `MOUNTAINS` / `DESERT`) are mapped as secondary habitats to `HILLS` (*Raven Crags*), `SWAMP` (*Deadman's Mire Sunken Ruins `[4,11]`*), and `FOREST` (*Heart of Mirkwood `[7,3]`*), OR `[4,11]` *Deadman's Mire* is updated to `terrain = 'UNDERGROUND_RUINS'` and `[1,1]..[3,2]` *Northwest Raven Crags* includes passable `MOUNTAINS` / `UNDERGROUND_RUINS` tiles!
   - *Giant Crab* and *Sahuagin* (`COAST` / `RIVER_LAKE` / `AQUATIC`) are mapped to `BRIDGE` `(8,7)` (*The Old Stone Bridge*) and river-adjacent `SWAMP` / `PLAINS` tiles!
   - Populate `monster_terrains` for `BRIDGE` `(8,7)` with 12 river/bridge ambushers (*Goblin*, *Hobgoblin*, *Lizardfolk*, *Giant Frog*, *Giant Crab*, *Boggard*, *Sahuagin*, *Bugbear*, *Bunyip*, *Hobgoblin Captain*, *Troll*, *Wyvern*).

### 4.2 Expanding Monster Progression Across Levels 1–10
Instead of crowding all 98 monsters into `solo_level` 1–5 and leaving Levels 6–10 empty, redistribute the 98 monsters across **8 Solo Tiers (`solo_level` 1 through 8)** (with Boss/Bounty variants scaling to Levels 9–10):

| V2 `solo_level` | Monster Count | Target Hero Level | Target HP Band | Target AC Band | Target Attack Bonus | Target Avg Dmg / Hit | Base XP Reward | Representative Monsters Assigned to Tier |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **Tier 1** | 16 | Level 1 | `4 – 8` (`6.0`) | `12 – 15` (`13.8`) | `+1 – +3` (`+2.0`) | `2.5 – 4.5` (`3.4`) | `100 – 150` | *Kobold, Mite, Dire Rat, Goblin, Human Skeleton, Orc, Giant Centipede, Human Zombie* |
| **Tier 2** | 15 | Level 2 | `9 – 14` (`11.5`) | `14 – 16` (`14.8`) | `+3 – +4` (`+3.5`) | `4.0 – 6.0` (`4.8`) | `250` | *Wolf, Hyena, Gnoll, Hobgoblin, Giant Spider, Giant Frog, Lizardfolk, Troglodyte, Ghoul* |
| **Tier 3** | 15 | Level 3 | `15 – 21` (`18.0`) | `15 – 17` (`15.6`) | `+4 – +6` (`+5.0`) | `5.5 – 7.5` (`6.4`) | `450` | *Boar, Bugbear, Boggard, Blink Dog, Death Dog, Worg, Giant Bat, Hippogriff, Grick* |
| **Tier 4** | 14 | Level 4 | `22 – 29` (`25.5`) | `16 – 18` (`16.8`) | `+6 – +7` (`+6.5`) | `7.0 – 9.5` (`8.0`) | `700` | *Choker, Ghast, Gnoll Packmaster, Ankheg, Cheetah, Ettercap, Giant Mantis, Rust Monster* |
| **Tier 5** | 12 | Level 5 | `30 – 38` (`34.0`) | `17 – 19` (`17.8`) | `+7 – +9` (`+8.0`) | `8.5 – 11.5` (`9.8`) | `1,000` | *Assassin Vine, Hobgoblin Captain, Giant Scorpion, Draugr, Wight, Spriggan, Skeletal Champion* |
| **Tier 6** | 10 | Level 6 | `39 – 48` (`43.5`) | `18 – 20` (`18.8`) | `+9 – +10` (`+9.5`) | `10.5 – 13.5` (`11.8`) | `1,400` | *Ogre, Will-o'-Wisp, Owlbear, Gargoyle, Griffon, Harpy, Dire Boar, Displacer Beast* |
| **Tier 7** | 8 | Level 7 | `50 – 62` (`56.0`) | `19 – 21` (`19.8`) | `+10 – +12` (`+11.0`) | `12.5 – 15.5` (`13.8`) | `1,900` | *Forest Drake, Leucrotta, Shambling Mound, Yeti, Giant Stag Beetle, Minotaur, Peryton, Otyugh* |
| **Tier 8+** | 8 | Levels 8–10 | `64 – 82` (`72.0`) | `20 – 22` (`21.0`) | `+12 – +14` (`+13.0`) | `14.5 – 18.5` (`16.2`) | `2,500` | *Manticore, Troll, Winter Wolf, Girallon, Green Hag, Wyvern, Orc Warchief, Mummy* |

### 4.3 Combat Formula Upgrades V2 (`src/domain/combat/rules.js` & `abilities.js`)
1. **Enable Real Weapon Critical Hits (Bounded for Permadeath Safety):**
   - Read `crit_threat` (`18`, `19`, `20`) and `crit_mult` (`2`, `3`, `4`) from `weapon.attributes` for **hero attacks**:
     - If `naturalRoll >= critThreat` and the attack hits, roll a **Critical Confirmation** (`1d20 + attackBonus >= targetAC`).
     - On a confirmed critical hit, add **+1 extra roll of `weapon.damage_dice`** (plus `+50%` of flat damage bonus for `x3`/`x4` weapons). This makes *Scimitars/Rapiers* (`18–20`), *Longswords/Greatswords* (`19–20`), and *Battleaxes/Warhammers/Bows* (`20/x3`) feel distinct and exciting!
   - **Permadeath Protection:** Monsters only crit on a Natural `20` and add at most `+50%` of their base weapon die (never multiplying flat damage or ability damage), preventing random 1-shot monster crit spikes.
2. **Split `'PHYSICAL'` Save into `'FORT'` and `'REF'` (`src/domain/combat/abilities.js:75-100`):**
   - `FORT` (`baseFort + CON_mod + cloakBonus`): resists Poison, Disease, Paralysis, Stench, Putrid Spores, Energy/Stat Drain, Petrification.
   - `REF` (`baseRef + DEX_mod + cloakBonus`): resists Web, Entangle, Grab/Tongue, Trip, Acid Spit, Breath Weapons, Trample, Spike Volley.
   - `WILL` (`baseWill + WIS_mod + cloakBonus`): resists Fear/Scare, Captivating Song, Enthrall, Evil Eye, Gibbering, Despair.
3. **Stun / Paralysis Recovery Guard (`abilities.js`):**
   - A hero cannot be Stunned or Paralyzed on **two consecutive rounds** (after losing 1 turn to Stun/Paralysis, the hero gains 1 round of *Stun Immunity*), eliminating inescapable stunlock deaths.

---

## 5. Progression & Economy V2 Specification

### 5.1 Calibrated 10-Level XP Curve & Anti-Grind Decay
Replace the uneven kill pacing of `FAST_XP_TABLE` with a smooth progression curve where early levels require `5–6` same-tier kills and higher levels require `7–10` same-tier kills:

| Level | V2 Total XP | Incremental $\Delta\text{XP}$ | Same-Tier Monster XP | Target Same-Tier Kills | Cumulative Kills from L1 | Expected Cumulative Wealth (gp) |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **1 $\to$ 2** | `750` | `750` | `135` (Tier 1 avg) | **5.5 kills** | ~5.5 | `~140 gp` |
| **2 $\to$ 3** | `2,250` | `1,500` | `250` (Tier 2) | **6.0 kills** | ~11.5 | `~420 gp` |
| **3 $\to$ 4** | `5,250` | `3,000` | `450` (Tier 3) | **6.7 kills** | ~18.2 | `~950 gp` |
| **4 $\to$ 5** | `10,250` | `5,000` | `700` (Tier 4) | **7.1 kills** | ~25.3 | `~1,850 gp` |
| **5 $\to$ 6** | `18,250` | `8,000` | `1,000` (Tier 5) | **8.0 kills** | ~33.3 | `~3,400 gp` |
| **6 $\to$ 7** | `30,250` | `12,000` | `1,400` (Tier 6) | **8.6 kills** | ~41.9 | `~5,800 gp` |
| **7 $\to$ 8** | `47,250` | `17,000` | `1,900` (Tier 7) | **8.9 kills** | ~50.8 | `~9,200 gp` |
| **8 $\to$ 9** | `70,250` | `23,000` | `2,500` (Tier 8) | **9.2 kills** | ~60.0 | `~14,000 gp` |
| **9 $\to$ 10** | `100,000` | `29,750` | `3,000` (Tier 8+ / Boss) | **9.9 kills** | ~70.0 | `~21,000 gp` |

- **Level-Difference XP Modifier:** If $L_{\text{hero}} - L_{\text{monster}} \ge 2$, multiply XP gained by $\max(0.10,\, 1 - 0.25 \times (L_{\text{hero}} - L_{\text{monster}} - 1))$ so high-level heroes cannot safely farm Tier 1 monsters in the starting plains to reach Level 10.

### 5.2 Equipment Tiers, Pricing & Active Consumables V2
1. **Introduce Masterwork Weapons (`300–350 gp`, `+1 Attack Bonus`, `+0 Damage Bonus`):** Bridges the gap at Levels 2–3 before `+1` Magic Weapons (`1,200 gp` V2 price, reduced from `2,315 gp` so a Level 4–5 hero can actually afford one!).
2. **Reprice Magic Weapon & Armor Progression to Match Solo Economy:**
   - **Masterwork Weapon (`+1 Atk`):** `320 gp` (Target: Level 2–3)
   - **`+1` Weapon (`+1 Atk, +1 Dmg`):** `1,200 gp` (Target: Level 4–5)
   - **`+2` Weapon (`+2 Atk, +2 Dmg`):** `3,800 gp` (Target: Level 6–7)
   - **`+3` Weapon (`+3 Atk, +3 Dmg`):** `9,500 gp` (Target: Level 8–9)
3. **Fix Broken Items & Populate All 9 Slots:**
   - **`Boots of Elvenkind` (`FEET`, `1,200 gp`):** Grant **`+1 DEX_mod` to Initiative, `+2` Perception vs. Ambush, and `+10%` Flee Chance**.
   - **`Bracers of Armor +1` (`800 gp`):** Change `equip_slot` or grant `+1 AC` and `+1 Reflex Save` as a light ward, or replace with **`Helm of Stalwart Vigil` (`HEAD`/`ACCESSORY`, `+1 AC, +2 vs Stun/Fear`)**.
   - **Activate All 7 Inactive Potions (`INACTIVE_CONSUMABLE_NAMES`):**
     - *Antitoxin (`50 gp`):* Purges active Poison and grants Poison Immunity for the current/next encounter.
     - *Potion of Shield of Faith (`120 gp`) & Barkskin (`200 gp`):* Grant `+2 AC` for the duration of the combat (or next combat if drunk in exploration).
     - *Potion of Bull's Strength (`200 gp`) & Cat's Grace (`200 gp`):* Grant `+4 STR` (`+2` Atk/Dmg) or `+4 DEX` (`+2` Ranged Atk/AC/Ref) for 1 combat.
     - *Potion of Heroism (`400 gp`):* Grants `+2 Attack, +2 Saving Throws, and +10 Temporary HP` for 1 combat.
     - *Elixir of Dragon's Breath (`350 gp`):* Combat action dealing `4d6` unerring Fire damage (`2d6` on Reflex save) to the enemy and disabling Troll Regeneration.
   - **Fix Duplicate Healing Potion:** Change `Minor Healing Potion` (`25 gp`) to `1d6+2` (`3–8 HP`) and `Potion of Cure Light Wounds` (`50 gp`) to `2d6+3` (`5–15 HP`), scaling cleanly into `Cure Moderate` (`150 gp`, `3d8+5`), `Cure Serious` (`350 gp`, `5d8+8`), and `Cure Critical` (`700 gp`, `7d8+12`).
4. **Global Resale Market Safeguards:**
   - Exclude consumable `POTION` items from `market_listings` (potions are consumed/recycled by the vendor on sale).
   - Gate purchasing from `market_listings` by **Character Level $\ge \text{item.min\_cr}$** so a brand-new Level 1 character cannot buy a high-tier `+2`/`+3` weapon dumped into the market by a previous high-level hero.

---

## 6. World Danger Zones & Permadeath Safeguards V2

### 6.1 Concentric Regional Danger Zones (`selectMonsterForTile` V2)
Instead of uncapped Gaussian sampling across all monster tiers on every tile, each region/distance band from Oakhaven `(7,7)` defines a **Zone Monster Tier Range `[MinTier, MaxTier]`**:

| Zone Band | Regions / Coordinates | Manhattan Distance from Oakhaven `(7,7)` | Allowed Monster `solo_level` Band | Base Encounter Rate (`action-ui-lab`) |
| :--- | :--- | :---: | :---: | :---: |
| **Zone 1: Sanctuary Greenbelt** | *Oakhaven Gates `(7,6)`, `(7,8)` & Inner Verdant Plains `(5..8, 6..8)`* | `1 – 2` tiles | **Tier 1 – 2** (Hard Cap: **Tier 2**) | `0%` exit / `8%–16%` |
| **Zone 2: Near Frontier** | *Southern Mirkwood `(4..11, 4..5)`, Old Stone Bridge `(8,7)`, Eastern Plains `(9..13, 6..8)`* | `2 – 4` tiles | **Tier 1 – 4** (Gaussian $\sigma = 1.1$) | `16% – 22%` |
| **Zone 3: Deep Wilderness** | *Northern Mirkwood `(4..11, 1..3)`, Raven Crags `(1..4, 1..8)`, Upper Rotting Fen `(1..7, 9..10)`* | `4 – 7` tiles | **Tier 3 – 6** (Gaussian $\sigma = 1.2$) | `22% – 28%` |
| **Zone 4: Lethal Borderlands & Landmarks** | *Heart of Mirkwood `(7,3)`, Deep Rotting Fen & Deadman's Mire `(1..7, 11..13)`, Venomous Jungle `(8..13, 9..13)`* | `5 – 11` tiles | **Tier 5 – 8+** (Gaussian $\sigma = 1.2$) | `28% – 30%` |

- **Mathematical Guarantee:** A Level 1 character exploring Zone 1 (`1–2` tiles from Oakhaven) has a **0.0% chance** of ever encountering a Tier 3+ monster, while venturing into *Venomous Jungle* or *Deadman's Mire* guarantees dangerous Tier 5–8 threats even for a low-level thrill-seeker!
