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
| **Gold Drop Frequency** | 55.7% (5,566) | 54.8% (5,483) | 80.0% (8,000) | 50%–55% standard, 80% dragon |
| **Avg Gold When Dropped** | 3.0 gp | 12.0 gp | 406.5 gp | Scales gracefully with CR |
| **Avg Gold Per Encounter** | 1.7 gp | 6.6 gp | 325.2 gp | Smooth economic ramp |
| **Item Drop Frequency** | 28.3% (2,829) | 29.5% (2,954) | 95.6% (9,557) | ~25%–30% standard, 90%+ hoard |
| **Total Items Awarded** | 2,845 | 2,985 | 10,406 | Controlled item flow |
| **Magical Items Dropped** | 47 (1.65% of items) | 126 (4.22% of items) | 890 (8.55% of items) | < 5% low/mid, controlled high |

---

## 2. Rarity Distribution Analysis

| Rarity Tier | Low CR (10k Rolls) | Mid CR (10k Rolls) | High CR (10k Rolls) | Total Items Dropped | Global % |
|---|---|---|---|---|---|
| **COMMON** | 2,499 (87.8%) | 2,648 (88.7%) | 2,406 (23.1%) | 7,553 | 46.5% |
| **UNCOMMON** | 346 (12.2%) | 337 (11.3%) | 5,078 (48.8%) | 5,761 | 35.5% |
| **RARE** | 0 (0.0%) | 0 (0.0%) | 2,694 (25.9%) | 2,694 | 16.6% |
| **EPIC** | 0 (0.0%) | 0 (0.0%) | 161 (1.55%) | 161 | 1.0% |
| **LEGENDARY** | 0 (0.0%) | 0 (0.0%) | 67 (0.64%) | 67 | 0.4% |
| **Total Items** | **2,845** | **2,985** | **10,406** | **16,236** | **100.0%** |

### Key Observations:
1. **Low and Mid CR Tiers:** Strictly bounded to `COMMON` (~88%) and `UNCOMMON` (~12%). Players will never obtain balance-distorting high-tier artifacts from early wilderness wandering.
2. **High CR Dragon Hoard:** The Young Green Dragon (CR 8, Double Treasure) queries the rebalanced `DRAGON_HOARD` loot table, generating an authentic pyramid: ~23% Common coins/gems, ~49% Uncommon jewelry/valuables, ~26% Rare gems and enchantments, ~1.5% Epic gemstones, and a truly scarce 0.6% Legendary relics.
3. **Legendary Scarcity:** Across mundane and standard encounters, legendary drop frequency is strictly 0.0%, and even in apex dragon hoards it is restricted to ~0.6% (approx. 1 in 155 dragon kills), preserving legendary status as an apex achievement.

---

## 3. Item Category Distribution

| Category | Low CR | Mid CR | High CR (Dragon) | Total Items |
|---|---|---|---|---|
| **WEAPON** | 1,303 (45.8%) | 1,293 (43.3%) | 134 (1.3%) | 2,730 |
| **ARMOR** | 592 (20.8%) | 675 (22.6%) | 238 (2.3%) | 1,505 |
| **SHIELD** | 333 (11.7%) | 307 (10.3%) | 104 (1.0%) | 744 |
| **POTION** | 242 (8.5%) | 319 (10.7%) | 294 (2.8%) | 855 |
| **OTHER / TREASURE** | 375 (13.2%) | 391 (13.1%) | 9,636 (92.6%) | 10,402 |

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
