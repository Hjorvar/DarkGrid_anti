# DARKGRID — PHASE 7A.3: FREE ATTRIBUTE ALLOCATION, LEVEL-UP & HIDDEN MATHEMATICS

**Date:** 2026-10-22  
**Phase:** 7A.3 — Final Design Corrections, Monster Families & Battle Experience  
**Status:** Authoritative Specification (Supersedes `PHASE-7A2-CHARACTER-CREATION.md` and `PHASE-7A2-DESIGN-PHILOSOPHY.md` Section 3.1 on Attribute Visibility)

---

## 1. Free Starting Attribute Allocation (72 Points, Bounds 8–18)

### 1.1 Replacement of Previous Systems
- **Retires Phase 6 (`src/config/index.js` / `src/domain/character/rules.js`):** Phase 6 enforced a `71`-point pool (`68` class base + `3` bonus points) with class-locked minimums (`base - 2`, e.g., Fighter could not lower `STR` below `12` or `CON` below `12`).
- **Retires Phase 7A.2 (`PHASE-7A2-CHARACTER-CREATION.md`):** Phase 7A.2 proposed hiding all attribute numbers and forcing players into a fixed `66`-point class array plus two dropdown aptitudes (`+4` / `+2`).
- **Establishes Phase 7A.3 Free Allocation:** Players freely distribute their starting attributes across all six ability scores (`STR`, `DEX`, `CON`, `INT`, `WIS`, `CHA`) within universal bounds. Class identity arises from **class abilities, weapon/armor proficiency, Hit Die, and level progression**, not from locking the player out of custom attribute builds.

### 1.2 Locked Character Creation Rules

| Rule Parameter | Phase 7A.3 Value | Validation Formula |
|---|---|---|
| **Attributes** | `STR, DEX, CON, INT, WIS, CHA` | All 6 must be integer values. |
| **Starting Attribute Total** | **`72` points** | $\text{STR} + \text{DEX} + \text{CON} + \text{INT} + \text{WIS} + \text{CHA} = 72$ |
| **Creation Minimum (per stat)** | **`8`** | $\forall s \in \text{Stats}: s \ge 8$ |
| **Creation Maximum (per stat)** | **`18`** | $\forall s \in \text{Stats}: s \le 18$ |
| **Cost Scale** | **1-for-1 Point Allocation** | Every +1 attribute point costs 1 point from the 72-point total (`24` distributable points above the `6 × 8 = 48` floor). |

---

## 2. Validated Class Presets (Default Starting Arrays)

When a player selects **Fighter**, **Ranger**, or **Cleric** in the Character Creation screen, the UI pre-populates the six attributes with the owner-specified class preset. The player may immediately forge their hero with the preset **or** freely adjust any attribute between `8` and `18` as long as the total equals `72`.

| Attribute | Fighter Preset | Ranger Preset | Cleric Preset | Bounds Check (`8..18`) |
|---|---:|---:|---:|---|
| **Strength (`STR`)** | `14` | `10` | `12` | ✅ Valid (`10..14` $\in [8,18]$) |
| **Dexterity (`DEX`)** | `12` | `16` | `10` | ✅ Valid (`10..16` $\in [8,18]$) |
| **Constitution (`CON`)** | `14` | `12` | `12` | ✅ Valid (`12..14` $\in [8,18]$) |
| **Intelligence (`INT`)** | `10` | `10` | `10` | ✅ Valid (`10` $\in [8,18]$) |
| **Wisdom (`WIS`)** | `12` | `14` | `16` | ✅ Valid (`12..16` $\in [8,18]$) |
| **Charisma (`CHA`)** | `10` | `10` | `12` | ✅ Valid (`10..12` $\in [8,18]$) |
| **Total Points** | **`72`** | **`72`** | **`72`** | ✅ **All three presets sum to exactly `72` and satisfy `8 <= stat <= 18`.** |

### Why These Presets Work Mechanically
- **Fighter (`14 / 12 / 14 / 10 / 12 / 10`):** Starts with solid melee accuracy/damage (`STR 14`), full `DEX` allowance inside Chainmail/Scale Mail (`DEX 12`), high durability (`CON 14`), no `INT` beginner penalty (`INT 10`), and early `WIS` Battle Experience AC growth (`WIS 12` grants `+1 AC` at *Experienced*).
- **Ranger (`10 / 16 / 12 / 10 / 14 / 10`):** Excels in ranged accuracy, *Opening Shot*, initiative, and light-armor evasion (`DEX 16`), with strong *Wilderness Instinct* perception and `WIS 14` Battle Experience defense (`+1 AC` from the very first victory).
- **Cleric (`12 / 10 / 12 / 10 / 16 / 12`):** Maximizes sacred Undead power, Will saves, *Divine Self-Healing* potency, and `WIS 16` Battle Experience defense (`+1 AC` after 1 win, `+2 AC` after 3 wins), while keeping `STR 12` and `CON 12` for mace-and-shield frontline endurance and `CHA 12` for *Turn Undead* / sanctuary interactions.

---

## 3. Level-Up Attribute Progression (Levels 2, 4, 6, 8, and 10)

### 3.1 Earning & Spending Attribute Points
1. **Milestone Levels:** A character earns **exactly `+1` attribute point** upon reaching **Level 2, Level 4, Level 6, Level 8, and Level 10** (`5` points total across Levels 1–10).
2. **Free Choice:** The player may invest an earned point into **any** of the six attributes (`STR, DEX, CON, INT, WIS, CHA`).
3. **No Automatic Allocation:** The server never auto-spends level-up points.
4. **Persistent Banking:** Unspent `attribute_points` are stored on the `characters` row in SQLite and persist across combat, town visits, logout/login, and page reloads until spent.
5. **Lifetime Total Verification Invariant:** At any Level $L \in [1, 10]$, a character created under Phase 7A.3 rules must satisfy:
   $$\sum_{s \in \{\text{STR,DEX,CON,INT,WIS,CHA}\}} \text{base\_}s + \text{unspent\_attribute\_points} = 72 + \left\lfloor \frac{L}{2} \right\rfloor$$
   *(Legacy 71-point characters created prior to Phase 7B remain valid via backward-compatible validation allowing total base sum `71` or `72`.)*

### 3.2 Handling Attribute Scores Above 18 (Post-Creation Scaling)
The **maximum of `18` applies strictly at Character Creation** (`Level 1`). It does **not** block Level-Up investments or equipment bonuses from raising an attribute above `18`:
1. **Base Score Ceiling (`23` at Level 10):** A player who starts with `18` in an attribute at Level 1 and invests all five Level-Up points (`L2, 4, 6, 8, 10`) into that same attribute reaches a natural base score of **`23`**.
2. **Equipped Effective Ceiling (`25` at Level 10):** Equipment bonuses (such as `Belt of Giant Strength +2` on the `WAIST` slot) stack on top of the natural base score, allowing an effective score of up to **`25`**.
3. **Internal Modifier Scaling Above 18:**
   - Standard d20 ability modifiers continue to follow the universal deterministic formula without artificial clamping:
     $$M_{\text{stat}} = \left\lfloor \frac{\text{effective\_stat} - 10}{2} \right\rfloor$$
     - Score `18–19` $\rightarrow$ `+4`
     - Score `20–21` $\rightarrow$ `+5`
     - Score `22–23` $\rightarrow$ `+6`
     - Score `24–25` $\rightarrow$ `+7`
   - **Battle Experience Table (`18+` Row):** The Battle Experience lookup table uses `18+` as its top tier (`+2` / `+4` learned Damage for `INT >= 18`; `+2` / `+3` learned AC for `WIS >= 18`), preventing runaway quadratic scaling while still rewarding `INT`/`WIS` `20+` through standard `INT`/`WIS` checks (Investigation, Awareness, Will saves, Cleric Divine Self-Healing, and Sacred Strike).

---

## 4. Mandatory Retroactive Constitution & Hit Point Rule

### 4.1 Canonical Max HP Formula
To resolve the discrepancy between [`PHASE-7A2-CLASS-PROGRESSION.md`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/docs/phase-7a2/PHASE-7A2-CLASS-PROGRESSION.md) (`10 + 6*(L-1)` / `8 + 5*(L-1)`) and legacy [`src/domain/character/rules.js`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/src/domain/character/rules.js#L62-L67) (`10 * L` / `8 * L`), Phase 7A.3 defines the single authoritative Max HP formula at Character Level $L$ with effective Constitution modifier $M_{\text{con}} = \lfloor (\text{CON} - 10)/2 \rfloor$:

$$\text{MaxHP}(L, M_{\text{con}}) = \max\Big(L,\; H_1 + (L - 1) \times H_{\text{lvl}} + B_{\text{class}}(L) + L \times M_{\text{con}}\Big)$$

Where:
- **Fighter:** $H_1 = 10$, $H_{\text{lvl}} = 6$, and *Battle-Hardened* $B_{\text{class}}(L) = (1 + L)$ for $L \in [1,4]$ and $2L$ for $L \in [5,10]$.
- **Ranger:** $H_1 = 8$, $H_{\text{lvl}} = 5$, $B_{\text{class}}(L) = 0$.
- **Cleric:** $H_1 = 8$, $H_{\text{lvl}} = 5$, $B_{\text{class}}(L) = 0$.

### 4.2 Retroactive Adjustment When `CON` Changes
Constitution affects Hit Points **retroactively across all character levels**:
1. **Increasing `CON` Modifier ($\Delta M_{\text{con}} = +1$, e.g., `CON 13 -> 14` at Level $L$):**
   - `Max HP` increases immediately by $+L$.
   - `Current HP` increases immediately by $+L$ (capped at the new `Max HP`).
   - **No Free Full Heal:** Missing HP (`Max HP - Current HP`) remains unchanged. If a Level 6 hero at `20 / 40 HP` raises `CON` from `13` to `14`, their HP becomes **`26 / 46 HP`**, never `46 / 46 HP`.
2. **Increasing `CON` to an Odd Number ($\Delta M_{\text{con}} = 0$, e.g., `CON 14 -> 15`):**
   - `Max HP` and `Current HP` change by `0` on that step; the full $+L$ retroactive gain triggers when `CON` reaches the next even score (`16`).
3. **Equipment `CON` Changes:**
   - Equipping or unequipping an item with a `CON` bonus adjusts `Max HP` by $L \times \Delta M_{\text{con}}$ and clamps `Current HP` to $\max(1, \min(\text{newMaxHp}, \text{currentHp} + \max(0, L \times \Delta M_{\text{con}})))$ so unequipping gear in town can never kill a living character.

---

## 5. Hidden Mathematics vs. Visible Attribute Allocation

### 5.1 What IS Visible to the Player
To allow players to make informed decisions when distributing their `72` creation points and their `+1` Level-Up points (`L2, 4, 6, 8, 10`), the following numbers **are explicitly visible**:
1. **Character Creation & Level-Up Allocation UI:**
   - The **attribute integer** (`8` through `18` at creation; `8` through `23+` at level-up) next to its qualitative tier label (e.g., `STR 14 — Strong`, `DEX 16 — Nimble`, `WIS 16 — Wise`).
   - The **Points Remaining counter** (`Points Remaining: 0 / 72` at creation; `Unspent Attribute Points: 1` at level-up).
   - A **Reset to Class Preset** button during character creation.
2. **Core Permadeath Tactical HUD:**
   - `Current HP / Max HP`, `Character Level`, `XP / Next Level XP`, `Gold`, `Potions / Arrows`, `Cleric Sacred Prayer Charges (X / Y)`, and `Fighter Second Wind Status (Ready / Spent)`.

### 5.2 What Remains Strictly Hidden (`Hidden Mathematics`)
Even where attribute integers (`14`, `16`) are shown for point allocation, the UI must **never** expose derived internal combat mathematics:
- ❌ **Never show ability modifiers:** Do not display `(+2)`, `(+3)`, or `(-1)` next to attribute scores.
- ❌ **Never show hit chances, attack bonuses, or damage formulas:** Do not display `Atk +6`, `1d8+4`, `+2 Attack vs Goblinoids`, or `85% hit chance`.
- ❌ **Never show AC integers or AC breakdown formulas:** Use qualitative protection labels (*Unarmored*, *Lightly Protected*, *Armored*, *Heavily Armored & Shielded*).
- ❌ **Never show the internal Battle Experience lookup table:** Communicate learned enemy knowledge through qualitative status badges (*Unfamiliar*, *Recognized*, *Experienced*) and combat narrative lines.

### 5.3 Descriptive Attribute Tier Labels (Used Across HUD & Champion Sheet)

| Attribute Score Range | `STR` | `DEX` | `CON` | `INT` | `WIS` | `CHA` |
|---|---|---|---|---|---|---|
| **`8–9`** | *Unconditioned* | *Stiff* | *Frail* | *Unstudied* | *Unwary* | *Reserved* |
| **`10–11`** | *Capable* | *Steady* | *Hale* | *Observant* | *Grounded* | *Composed* |
| **`12–13`** | *Sturdy* | *Deft* | *Hardened* | *Sharp-Minded* | *Attentive* | *Assured* |
| **`14–15`** | *Strong* | *Agile* | *Resilient* | *Analytical* | *Perceptive* | *Commanding* |
| **`16–17`** | *Mighty* | *Nimble* | *Stalwart* | *Tactical* | *Wise* | *Inspiring* |
| **`18–19`** | *Herculean* | *Razor-Quick* | *Iron-Blooded* | *Brilliant* | *Prescient* | *Sovereign* |
| **`20+`** | *Titan-Born* | *Wind-Swift* | *Unbreakable* | *Mastermind* | *Oracular* | *Mythic* |
