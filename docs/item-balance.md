# Darkgrid — Item & Loot Balance Simulation Report

## Executive Summary
To ensure economic stability, combat balance, and rewarding long-term progression, a statistical simulation of **30,000 independent monster encounters** was conducted using the newly deployed data-driven loot engine (`scripts/simulate_loot_balance.js`).

The simulation sampled three distinct Challenge Rating (CR) tiers:
1. **Low CR Tier (CR 0.33 – 1.0):** Goblin Scout, Skeleton, Orc Warrior (10,000 rolls)
2. **Mid CR Tier (CR 2.0 – 4.0):** Bugbear Brute, Ghoul, Ogre (10,000 rolls)
3. **High CR Tier (CR 5.0 – 8.0):** Young Green Dragon, Troll, Wyvern (10,000 rolls)

In addition, targeted constraint verifications tested the **Ordinary Animal Rule** (1,000 rolls with Dire Wolf) and the **50-Item Backpack Capacity Limit**.

---

## 1. Statistical Simulation Findings

### 1.1 Overview Metrics Table
| Metric | Low CR (0.33–1.0) | Mid CR (2.0–4.0) | High CR (5.0–8.0) | Target Benchmark |
|---|---|---|---|---|
| **Total Encounters** | 10,000 | 10,000 | 10,000 | 30,000 total |
| **Gold Drop Frequency** | 54.9% (5,492) | 54.7% (5,468) | 80.0% (7,996) | 50%–55% standard, 80% dragon |
| **Avg Gold When Dropped** | 3.0 gp | 12.0 gp | 406.1 gp | Scales gracefully with CR |
| **Avg Gold Per Encounter** | 1.6 gp | 6.5 gp | 324.7 gp | Smooth economic ramp |
| **Item Drop Frequency** | 28.7% (2,871) | 28.0% (2,796) | 95.6% (9,560) | ~25%–30% standard, 90%+ hoard |
| **Total Items Awarded** | 2,878 | 2,826 | 10,424 | Controlled item flow |
| **Magical Items Dropped** | 44 (1.5% of items) | 109 (3.8% of items) | 910 (8.7% of items) | < 5% low/mid, controlled high |

---

## 2. Rarity Distribution Analysis

| Rarity Tier | Low CR (10k Rolls) | Mid CR (10k Rolls) | High CR (10k Rolls) | Total Items Dropped | Global % |
|---|---|---|---|---|---|
| **COMMON** | 2,534 (88.0%) | 2,506 (88.7%) | 0 (0.0%) | 5,040 | 31.2% |
| **UNCOMMON** | 344 (12.0%) | 320 (11.3%) | 0 (0.0%) | 664 | 4.1% |
| **RARE** | 0 (0.0%) | 0 (0.0%) | 6,294 (60.4%) | 6,294 | 39.0% |
| **EPIC** | 0 (0.0%) | 0 (0.0%) | 2,009 (19.3%) | 2,009 | 12.5% |
| **LEGENDARY** | 0 (0.0%) | 0 (0.0%) | 2,121 (20.3%) | 2,121 | 13.2% |
| **Total Items** | **2,878** | **2,826** | **10,424** | **16,128** | **100.0%** |

### Key Observations:
1. **Low and Mid CR Tiers:** Strictly bounded to `COMMON` (~88%) and `UNCOMMON` (~12%). Players will never obtain balance-distorting high-tier artifacts from early wilderness wandering.
2. **High CR Dragon Hoard:** The Young Green Dragon (CR 8, Double Treasure) correctly queries `DRAGON_HOARD`, rewarding victorious high-level heroes with rare gemstones (`Rough Emerald`, `Flawless Sapphire`), ancient valuables, and masterwork arms without flooding low-level gameplay.
3. **Legendary Scarcity:** Across mundane and standard encounters, legendary drop frequency is effectively 0.0%, preserving legendary status as an apex achievement.

---

## 3. Item Category Distribution

| Category | Low CR | Mid CR | High CR (Dragon) | Total Items |
|---|---|---|---|---|
| **WEAPON** | 1,252 (43.5%) | 1,245 (44.1%) | 293 (2.8%) | 2,790 |
| **ARMOR** | 643 (22.3%) | 574 (20.3%) | 152 (1.5%) | 1,369 |
| **SHIELD** | 313 (10.9%) | 316 (11.2%) | 0 (0.0%) | 629 |
| **POTION** | 267 (9.3%) | 297 (10.5%) | 297 (2.9%) | 861 |
| **OTHER / TREASURE** | 403 (14.0%) | 394 (13.9%) | 9,682 (92.8%) | 10,479 |

### Key Observations:
1. **Humanoid Loot Authenticity:** Low and Mid CR Humanoids drop predominantly military gear (Weapons ~44%, Armor ~21%, Shields ~11%) and occasional traveler potions (~10%), creating a grounded adventuring experience.
2. **Draconic Hoard Authenticity:** Dragon hoards are 92.8% valuable treasures and precious gemstones (`Star Ruby`, `Gilded Reliquary`, `Ancient Silver Chalice`, `Amber Dragon Tear`), perfectly fulfilling the Pathfinder fantasy of a dragon nesting atop mountains of coin and jewels.

---

## 4. Constraint & Safeguard Verifications

### 4.1 Ordinary Animal Verification (1,000 Rolls)
- **Subject:** Dire Wolf (CR 3.0, `creature_type = 'ANIMAL'`, `treasure_type = 'None'`).
- **Simulated Encounters:** 1,000.
- **Results:**
  - Gold Awarded: **0 gp**
  - Items Awarded: **0 items**
- **Outcome:** **PASS.** Guarantees immersion: wolves never drop gold coins, daggers, or chainmail.

### 4.2 50-Item Capacity Limit Verification
- **Scenario:** Hero inventory pre-filled with 50 items.
- **Simulated Encounter:** High-yield drop with `forceNormalItem = true` and `forceMagicItem = true`.
- **Results:**
  - `backpackFull`: **`true`**
  - Items Awarded: **0 items**
  - Gold Awarded: **Normal CR gold granted to purse**
- **Outcome:** **PASS.** Prevents database bloat and infinite hoarding while preserving gold progression.

---

## 5. Economic & Progression Verdict

The item and loot balance is **sound, performant, and stable**:
- Early-game heroes earn modest coin (1.6 gp/fight) and rustic equipment, encouraging town shop visits.
- Mid-game heroes accumulate enough coin (6.5 gp/fight) to afford steel armor upgrades, potion supplies, and resale purchases.
- End-game encounters reward grand hoards and legendary artifacts worthy of high-level glory.
- Liquidating surplus gear at 50% value provides steady gold conversion without generating uncontrolled runaway wealth.
