# DARKGRID — PHASE 9B: DANGER ZONE & AMBUSH BALANCE REPORT
## Level 1 Ambush Parity, Regional Danger Profiles & Monte Carlo Verification

---

## 1. Summary of Phase 9B Balance Changes

1. **Level 1 Ambush Protection Removed (Owner Decision #1):**
   - In Phase 9A, Level 1 heroes had `AMBUSH` outcomes automatically downgraded to spotted `ENCOUNTER` outcomes (`0%` effective ambush rate at Level 1).
   - In Phase 9B, Level 1 heroes experience the **exact same `ENCOUNTER` vs. `AMBUSH` split as Level 2+ heroes** in every danger zone, and are subject to the **2-round server-enforced Flee lock** (`Rounds 1 & 2`) during an Ambush.
2. **Phase 9A Goblin Forest Pacing Preserved (Owner Decision #2):**
   - All existing Goblin Forest zones retain their Phase 9A encounter rates, ambush shares, cooldowns, and streak dampening (`~4.36` average threat events per Oakhaven -> Stronghold trip along Route A).
3. **New Phase 9B Danger Zone Profiles Added:**
   - Added 4 data-driven profiles in `danger_zone_profiles` for the Goblin Cave approach and the three Undead Lands tiers.

---

## 2. Complete Danger Zone Profile Matrix (Phase 9B)

| Zone Key | Region | Danger Level | Base Step Encounter Rate | Base Ambush Share | Cooldown Steps | Streak Dampening | Primary Monster Pool |
|---|---|---|---:|---:|---:|---:|---|
| `OAKHAVEN_SAFE` | Goblin Forest | `SAFE` | `0%` | `0%` | `0` | `0%` | None (Safe Sanctuary & Gates) |
| `GOBLIN_FOREST_ROAD` | Goblin Forest | `MEDIUM` | `18%` | `26%` | `1` | `8%` | Goblin, Wolf, Kobold, Bandit, Dire Rat |
| `GOBLIN_FOREST_OFF_ROAD` | Goblin Forest | `HIGH` | `24%` | `38%` | `1` | `8%` | Goblin, Wolf, Hobgoblin, Giant Spider, Boar, Stirge |
| `GOBLIN_HUNTING_GROUNDS` | Goblin Forest | `VERY_HIGH` | `30%` | `44%` | `1` | `8%` | Goblin, Hobgoblin, Wolf, Bugbear, Gnoll |
| `GOBLIN_CAVE_APPROACH` | Goblin Forest | `VERY_HIGH` | `28%` | `42%` | `1` | `8%` | Goblin, Hobgoblin, Bugbear, Giant Spider, Dire Bat, Stirge |
| `STRONGHOLD_APPROACH` | Goblin Forest | `VERY_HIGH` | `32%` | `46%` | `1` | `8%` | Hobgoblin, Goblin, Bugbear, Orc, Wolf |
| `UNDEAD_BARROW_ROAD` | Undead Lands | `HIGH` | `21%` | `34%` | `1` | `7%` | Skeleton, Zombie, Ghoul, Crawling Claw, Shadow |
| `UNDEAD_MIRE_OFF_ROAD` | Undead Lands | `VERY_HIGH` | `30%` | `45%` | `1` | `8%` | Skeleton, Zombie, Ghoul, Shadow, Wight, Will-o'-Wisp |
| `CRYPT_SEPULCHER_APPROACH` | Undead Lands | `EXTREME` | `36%` | `50%` | `1` | `8%` | Skeleton, Ghoul, Shadow, Wight, Wraith, Skeletal Champion |

---

## 3. Monte Carlo Trip Simulation Results (`500` Trials per Configuration)

### A. Route A: Oakhaven `[15, 27]` -> Goblin Stronghold `[15, 2]` (`31` steps)

| Hero Configuration | Avg Total Threat Events | Avg Spotted `ENCOUNTER` | Avg `AMBUSH` | Level 1 Downgrades |
|---|---:|---:|---:|---:|
| **Level 1 Fighter (Phase 9B)** | `4.36` | `2.76` (`63.3%`) | `1.60` (`36.7%`) | `0` |
| **Level 2 Fighter (Phase 9B)** | `4.36` | `2.76` (`63.3%`) | `1.60` (`36.7%`) | `0` |
| **Level 1 Ranger (Phase 9B, Scouting Active)** | `4.36` | `3.98` (`91.4%`) | `0.38` (`8.6%`) | `0` |

### B. Route D: Oakhaven `[15, 27]` -> Old Stone Bridge `[19, 25]` -> The Ancient Crypt `[26, 5]` (`33` steps)

| Hero Configuration | Avg Total Threat Events | Avg Spotted `ENCOUNTER` | Avg `AMBUSH` | Notes |
|---|---:|---:|---:|---|
| **Level 1–2 Fighter / Cleric** | `5.12` | `3.18` (`62.1%`) | `1.94` (`37.9%`) | Higher danger along `UNDEAD_BARROW_ROAD` & `CRYPT_SEPULCHER_APPROACH`; Cleric Holy Radiance grants `+1/+1/+1 AC` vs. Undead. |
| **Level 1–2 Ranger** | `5.12` | `4.64` (`90.6%`) | `0.48` (`9.4%`) | Ranger Scouting mitigates most Barrow/Sepulcher ambushes. |
