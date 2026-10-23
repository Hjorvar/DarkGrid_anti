# DARKGRID — PHASE 7A.2: DESCRIPTIVE CHARACTER CREATION, ATTRIBUTES & RETROACTIVE CONSTITUTION RULES

> [!IMPORTANT]
> **Historical Design Baseline (Superseded by Phase 7A.3):** This Phase 7A.2 document is preserved as historical design context. Phase 7A.3 replaces the restricted 2-dropdown aptitude concept and the general `INT` combat-XP multiplier with **free player allocation of 72 starting points (`8–18` bounds)**, optional validated class presets, visible attribute integers during creation/level-up, post-18 level-up rules, and **Battle Experience**. See [`../phase-7a3/PHASE-7A3-ATTRIBUTES.md`](../phase-7a3/PHASE-7A3-ATTRIBUTES.md) and [`../phase-7a3/PHASE-7A3-BATTLE-EXPERIENCE.md`](../phase-7a3/PHASE-7A3-BATTLE-EXPERIENCE.md).

**Date:** 2026-10-22  
**Phase:** 7A.2 — Class Identity & Thematic Progression (Design & Documentation Only)  
**Baseline Verified Against:** `main` commit `042d122`

---

## 1. Attribute Design Philosophy: Descriptive Choices Over Spreadsheet Min-Maxing

In Darkgrid's current Character Forge UI ([`action-ui-lab/public/js/character/character-ui.js`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/public/js/character/character-ui.js#L679-L832)), players are presented with a 71-point numerical point-buy calculator (`10` to `18` spinners, displaying raw `+0` to `+4` modifiers). This encourages spreadsheet min-maxing, exposes the internal math, and leads to traps where players unknowingly strand odd attribute scores or dump survival stats.

Under Phase 7A.2's **Hidden Mathematics** rule:
1. **Internal Formula Preserved:** The server retains the clean Pathfinder-style modifier formula:
   $$\text{modifier} = \left\lfloor \frac{\text{attribute} - 10}{2} \right\rfloor$$
   There are **no** odd-stat micro-bonuses.
2. **Player-Facing Descriptive Experience:** During character creation and level-up (at Levels 2, 4, 6, 8, and 10), the player never sees raw attribute numbers (`16`) or modifiers (`+3`). Instead, the player shapes their hero through **descriptive aptitude choices** (*Strong*, *Agile*, *Tough*, *Perceptive*, *Wise*, *Commanding*).

---

## 2. Internal Role of Each Attribute (Deterministic Backend Mapping)

Every attribute retains a distinct, deterministic mechanical purpose in [`src/domain/character/rules.js`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/src/domain/character/rules.js) and [`src/domain/combat/rules.js`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/src/domain/combat/rules.js):

| Attribute | Descriptive Pillar | Internal Mechanical Effects (Hidden from UI) |Player-Facing Explanation |
| :--- | :--- | :--- | :--- |
| **Strength (`STR`)** | **Strong** | Melee attack accuracy (`+STR_mod`), melee & thrown weapon damage (`+STR_mod`), heavy armor/load readiness. | *"Governs the force of your melee blows and your power in close-quarters combat."* |
| **Dexterity (`DEX`)** | **Agile** | Ranged attack accuracy (`+DEX_mod`), Armor Class bonus (`+DEX_mod`, capped by armor max DEX), Reflex saves, Flee check bonus. | *"Governs your marksmanship with bows, your ability to dodge blows, and your speed when disengaging."* |
| **Constitution (`CON`)** | **Tough** | Retroactive Max HP per level (`+CON_mod × level`), Fortitude saves against poison, disease, petrification, and stun, Fighter *Second Wind* scaling. | *"Governs your vital endurance, lifeblood, and resistance to venom, rot, and physical shock."* |
| **Intelligence (`INT`)** | **Perceptive & Studied** | Encounter investigation depth, trap/camouflage recognition, and bonus combat learning (`+10%` XP per `+1 INT_mod`). | *"Governs your tactical observation, eye for hidden snares, and how quickly you learn from battle."* |
| **Wisdom (`WIS`)** | **Wise & Devout** | Encounter detection awareness, Will saves against fear/charms/madness, Cleric *Divine Self-Healing* and *Turn Undead* potency. | *"Governs your sixth sense for danger, mental resolve against terror, and the strength of sacred prayers."* |
| **Charisma (`CHA`)** | **Commanding & Resolute** | Town market & quartermaster favor (`-5%` purchase cost / `+5%` bounty & sale respect per `+1 CHA_mod`), Cleric *Turn Undead* presence. | *"Governs your presence among frontier folk, fair dealings with merchants, and authority against the dark."* |

---

## 3. Character Creation Flow: Class Calling + Descriptive Aptitudes

Instead of clicking `+` and `-` 71 times, creating a character in the **Character Forge** consists of four thematic steps:

### Step 1: Choose Class Archetype
- **Fighter — *The Survivor***
- **Ranger — *The Hunter***
- **Cleric — *The Undead Hunter***

### Step 2: Choose Primary & Secondary Aptitudes (Descriptive Build Identity)
Each class starts with a balanced, class-coherent foundational chassis and asks the player to choose **One Primary Aptitude** (*"What defines your training?"*) and **One Secondary Conditioning** (*"What second quality keeps you alive?"*):

#### Internal Chassis & Aptitude Resolution (Total = 72 Points, Even-Stat Aligned at L1)
Each class has a tailored base array (`[12, 12, 12, 10, 10, 10]` = 66 points) plus:
- **Primary Aptitude Choice:** Adds `+4` to the chosen primary attribute (`12 → 16`, or `10 → 14`).
- **Secondary Conditioning Choice:** Adds `+2` to a different chosen attribute (`12 → 14`, or `10 → 12`).

| Descriptive Choice Label | Target Attribute | Player-Facing Description in Character Forge |
| :--- | :---: | :--- |
| **Strong** (*Might & Heavy Strikes*) | `STR` | *"You rely on raw physical power to crush shields and drive blades through thick hide."* |
| **Agile** (*Precision & Evasion*) | `DEX` | *"You move with sure-footed grace, striking from afar and slipping past clumsy lunges."* |
| **Tough** (*Endurance & Lifeblood*) | `CON` | *"You are built to endure punishment, shrugging off deep wounds and foul venoms."* |
| **Perceptive** (*Keen Mind & Observation*) | `INT` | *"You study every track and ruin, learning swiftly from every violent encounter."* |
| **Wise** (*Vigilance & Inner Faith*) | `WIS` | *"Your instincts warn you of unseen peril, and your spirit stands firm against dread."* |
| **Commanding** (*Presence & Frontier Respect*) | `CHA` | *"Your resolute bearing commands respect in frontier towns and steadies your heart."* |

#### Default Class Base Arrays (Before Primary `+4` & Secondary `+2`)
- **Fighter Base (`66 pts`):** `STR 12, DEX 12, CON 12, INT 10, WIS 10, CHA 10`
  - *Example ("Strong & Tough" Fighter):* `STR 16 (+3), CON 14 (+2), DEX 12 (+1), INT 10, WIS 10, CHA 10` (72 pts).
  - *Example ("Agile & Strong" Archer/Skirmisher Fighter):* `DEX 16 (+3), STR 14 (+2), CON 12 (+1), INT 10, WIS 10, CHA 10` (72 pts).
- **Ranger Base (`66 pts`):** `STR 12, DEX 12, CON 12, INT 10, WIS 10, CHA 10`
  - *Example ("Agile & Wise" Stalker Ranger):* `DEX 16 (+3), WIS 12 (+1), STR 12 (+1), CON 12 (+1), INT 10, CHA 10` (72 pts).
  - *Example ("Agile & Tough" Hardy Ranger):* `DEX 16 (+3), CON 14 (+2), STR 12 (+1), INT 10, WIS 10, CHA 10` (72 pts).
- **Cleric Base (`66 pts`):** `STR 12, DEX 10, CON 12, INT 10, WIS 12, CHA 10`
  - *Example ("Wise & Tough" Exorcist Cleric):* `WIS 16 (+3), CON 14 (+2), STR 12 (+1), DEX 10, INT 10, CHA 10` (72 pts).
  - *Example ("Strong & Wise" Crusader Cleric):* `STR 16 (+3), WIS 14 (+2), CON 12 (+1), DEX 10, INT 10, CHA 10` (72 pts).

> [!TIP]
> **API Compatibility:** On the backend (`postCreateCharacter` in [`auth-character-controller.js`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/server/controllers/auth-character-controller.js)), the server accepts either `{ primaryAptitude, secondaryAptitude }` (resolving to the deterministic 72-point array) or direct legacy `{ str, dex, con, int, wis, cha }` payloads so existing automated unit tests continue to pass without friction.

### Step 3: Class Specialization Selection (Ranger Only)
- If the player selects **Ranger**, they choose **ONE Favored Enemy** from the 7 curated specializations defined in [`PHASE-7A2-MONSTER-KNOWLEDGE.md`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/docs/phase-7a2/PHASE-7A2-MONSTER-KNOWLEDGE.md), each accompanied by a rich thematic description of the quarry and its habitats.
- **Fighter** and **Cleric** display their innate specializations (*Know Your Enemy* and *Undead Hunter & Sacred Healer*) as part of their class creed.

### Step 4: Name & Portrait Selection
- Player enters their hero's name and chooses their portrait, then enters Oakheart Sanctuary.

---

## 4. Level-Up Experience (Levels 2, 4, 6, 8, and 10)

At **Levels 2, 4, 6, 8, and 10**, the hero earns one **Seasoned Conditioning** improvement (`+1` to a chosen attribute internally, or `+2` if we pair even-step descriptive training—see Section 4.1 below).

### 4.1 Preserving the Phase 7A.1 Baseline (`+1` Attribute at L2, 4, 6, 8, 10) with Descriptive Choices
In accordance with Section 6 of the Phase 7A.2 specification:
- Retain the internal formula `modifier = floor((attribute - 10) / 2)` without odd-stat micro-bonuses.
- Retain one attribute increase (`+1`) at **Levels 2, 4, 6, 8, and 10** (5 total increases across L1–10).
- **How Descriptive Choices Frame Odd vs. Even Steps Without Showing Numbers:**
  - When a player selects an attribute to improve at L2, L4, L6, L8, or L10 using the descriptive cards (*"Grow Stronger"*, *"Grow Tougher"*, *"Grow More Agile"*, *"Grow More Perceptive"*, *"Grow Wiser"*, *"Grow More Commanding"*):
    - If the internal attribute moves from an **even score to an odd score** (e.g., `14 → 15`), the descriptive text reads:
      - *"You lay the foundation for greater endurance; continued training in this discipline will unlock a new tier of vitality."*
    - If the internal attribute moves from an **odd score to an even score** (e.g., `15 → 16`, increasing the modifier from `+2` to `+3`), the descriptive text announces the breakthrough:
      - *"Your endurance has reached a new tier! Your lifeblood and resilience against poison and shock have visibly improved."*

### 4.2 Qualitative Attribute Tier Labels in the Champion Record Modal
Instead of displaying `STR: 16 (+3)`, the Champion Record modal displays the qualitative tier corresponding to the internal modifier:

| Internal Score Range | Internal Modifier | Strong (`STR`) | Agile (`DEX`) | Tough (`CON`) | Perceptive (`INT`) | Wise (`WIS`) | Commanding (`CHA`) |
| :---: | :---: | :--- | :--- | :--- | :--- | :--- | :--- |
| `<= 9` | `-1` | *Frail* | *Stiff* | *Weathered* | *Unlettered* | *Unwary* | *Grim* |
| `10–11` | `+0` | *Capable* | *Steady* | *Hale* | *Observant* | *Grounded* | *Measured* |
| `12–13` | `+1` | *Sturdy* | *Nimble* | *Hardy* | *Sharp* | *Attentive* | *Assured* |
| `14–15` | `+2` | *Strong* | *Agile* | *Tough* | *Perceptive* | *Wise* | *Commanding* |
| `16–17` | `+3` | *Mighty* | *Swift* | *Iron-Blooded* | *Astute* | *Devout* | *Inspiring* |
| `18–19` | `+4` | *Herculean* | *Uncanny* | *Unyielding* | *Sagacious* | *Enlightened* | *Sovereign* |
| `>= 20` | `+5` | *Titanic* | *Peerless* | *Immortal-Forged* | *Omniscient* | *Transcendent* | *Legendary* |

*(Note: If an attribute is at an odd score such as `15`, the UI can append a subtle subtitle: `"Tough (Honing toward Iron-Blooded)"` so the player always knows which discipline is one step away from a breakthrough without ever seeing `15 (+2)`!)*

---

## 5. Mandatory Retroactive Constitution & HP Rule

### 5.1 The Rule
> **Whenever a character's Constitution modifier (`CON_mod`) changes—whether through leveling up, permanent attribute effects, or equipment—`Max HP` is recalculated retroactively across EVERY character level.**

### 5.2 Exact Mathematical Specification

Let:
- $L$ = the character's current level ($1 \le L \le 10$).
- $H_1$ = Level 1 base hit die (`10` for Fighter, `8` for Ranger and Cleric).
- $H_{\text{lvl}}$ = fixed per-level hit die gain for levels $2 \dots L$ (`6` for Fighter, `5` for Ranger and Cleric).
- $B_{\text{class}}(L)$ = class toughness bonus HP (e.g., Fighter *Battle-Hardened*, `0` for Ranger/Cleric).
- $M_{\text{con}}^{\text{old}}$ = previous Constitution modifier $\lfloor (\text{CON}_{\text{old}} - 10) / 2 \rfloor$.
- $M_{\text{con}}^{\text{new}}$ = new Constitution modifier $\lfloor (\text{CON}_{\text{new}} - 10) / 2 \rfloor$.
- $\Delta M_{\text{con}} = M_{\text{con}}^{\text{new}} - M_{\text{con}}^{\text{old}}$.

#### Canonical Max HP Formula at Level $L$:
$$\text{MaxHP}(L, M_{\text{con}}) = H_1 + (L - 1) \times H_{\text{lvl}} + B_{\text{class}}(L) + \left( L \times M_{\text{con}} \right)$$
*(subject to a minimum floor of $\ge L$ HP).*

#### Retroactive Adjustment When $M_{\text{con}}$ Increases ($\Delta M_{\text{con}} > 0$):
$$\Delta \text{HP} = L \times \Delta M_{\text{con}}$$
$$\text{MaxHP}_{\text{new}} = \text{MaxHP}_{\text{old}} + \Delta \text{HP}$$
$$\text{CurrentHP}_{\text{new}} = \min\!\left(\text{MaxHP}_{\text{new}},\; \text{CurrentHP}_{\text{old}} + \Delta \text{HP}\right)$$

- **Crucial Constraint:** Increasing `CON_mod` increases `Current HP` by **exactly** $\Delta \text{HP} = L \times \Delta M_{\text{con}}$ (plus normal single-level HP gain if occurring simultaneously with a level-up), capped at $\text{MaxHP}_{\text{new}}$. **It MUST NOT fully heal prior missing HP.**

#### Worked Example (From Specification §6):
- A **Level 6 Fighter** currently has `Max HP = 52` and is wounded at `Current HP = 35` (`17` HP missing).
- The Fighter's `CON` modifier increases by `+1` ($\Delta M_{\text{con}} = +1$ at $L = 6$).
- $\Delta \text{HP} = 6 \times 1 = +6$.
- $\text{MaxHP}_{\text{new}} = 52 + 6 = 58$.
- $\text{CurrentHP}_{\text{new}} = \min(58, 35 + 6) = 41$ (still `17` HP below the new maximum—**not** healed to `58`).

#### Retroactive Adjustment When $M_{\text{con}}$ Decreases ($\Delta M_{\text{con}} < 0$):
If a permanent Constitution decrease occurs ($\Delta M_{\text{con}} < 0$, e.g., `-1` CON modifier at Level 6):
- $\Delta \text{HP} = L \times \Delta M_{\text{con}} = -6$.
- $\text{MaxHP}_{\text{new}} = \max(L,\; \text{MaxHP}_{\text{old}} - 6)$.
- $\text{CurrentHP}_{\text{new}} = \min\!\left(\text{MaxHP}_{\text{new}},\; \max(1,\; \text{CurrentHP}_{\text{old}} - 6)\right)$ *(unless the effect is an explicit lethal combat drain such as a Wraith's Constitution drain that reduces HP/CON to `0`, which triggers standard permadeath handling).*

### 5.3 Persistence, Logout/Login, and Reload Invariant
To guarantee that this rule behaves identically across leveling, database persistence, logout/login, and page reload:
1. Both `max_hp` and `current_hp` are persisted atomically in the `characters` SQLite table whenever level-up or attribute modification occurs in [`src/domain/character/rules.js`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/src/domain/character/rules.js).
2. A pure helper `calculateCanonicalMaxHp(character)` computes $\text{MaxHP}(L, M_{\text{con}})$ from `class`, `level`, and `con`.
3. Neither `getSession`, `buildClientState`, nor `ensureLivingHero` ever overwrites `current_hp` with `max_hp` on reload or login.
