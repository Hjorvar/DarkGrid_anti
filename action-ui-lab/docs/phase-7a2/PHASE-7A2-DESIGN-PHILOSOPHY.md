# DARKGRID — PHASE 7A.2: DESIGN PHILOSOPHY & HIDDEN MATHEMATICS

> [!IMPORTANT]
> **Historical Design Baseline (Updated by Phase 7A.3):** This Phase 7A.2 document is preserved as historical design context. Phase 7A.3 retains the core asymmetric class philosophy and Hidden Mathematics while permitting visible attribute integers (`8–18+`) and remaining point counts during Character Creation and Level-Up allocation. See [`../phase-7a3/PHASE-7A3-DESIGN-DECISIONS.md`](../phase-7a3/PHASE-7A3-DESIGN-DECISIONS.md) and [`../phase-7a3/PHASE-7A3-ATTRIBUTES.md`](../phase-7a3/PHASE-7A3-ATTRIBUTES.md).

**Date:** 2026-10-22  
**Phase:** 7A.2 — Class Identity & Thematic Progression (Design & Documentation Only)  
**Baseline Verified Against:** `main` commit `042d122` (Post-Phase-6.2 Source of Truth)  
**Status:** Authoritative Design Baseline (Supersedes Phase 7A.1 Parity Doctrine)

---

## 1. Core Mandate: "Make the Classes Different, Not Equal"

Darkgrid is a single-player, dark-fantasy, permadeath RPG with shared-world persistence (persistent wounded monsters, fallen hero corpses, and world-space bounties).

In Phase 7A and Phase 7A.1, balance proposals treated numerical parity across **Fighter**, **Ranger**, and **Cleric**—specifically equalizing expected direct-combat win rates within an $\le 8.0\text{ percentage-point}$ spread (`Gate G2`)—as a primary objective. **Phase 7A.2 formally rejects numerical class parity as a design goal.**

### Why Numerical Class Parity Is Rejected

1. **Single-Player Asymmetry Over Competitive Symmetry:** Darkgrid is not a competitive PvP arena or a MMO raid parser where classes compete for DPS slots. A player chooses a class to inhabit a distinct dark-fantasy archetype and survival philosophy.
2. **Homogenization Destroys Identity:** When all three classes are forced into an identical win-rate band against all monster categories:
   - The **Fighter** loses its identity as the unmatched general-purpose martial survivor.
   - The **Ranger**'s personal **Favored Enemy** specialization gets diluted into generic broad doctrines, and **Opening Shot** gets flattened into a routine combat math adjustment instead of a decisive ambush reward.
   - The **Cleric** gets distorted into a "second Fighter with mid-combat self-heals," erasing the tension of being a physically weaker combatant who survives through between-battle prayer and sacred mastery over the undead.
3. **Situational Dominance Creates Meaningful World Geography:** In a dangerous world, a class *should* feel substantially stronger than another class when operating inside its domain—and genuinely threatened when caught outside it:
   - A **Fighter** marching through a goblin- and orc-infested hill pass relies on heavy plate, shield discipline, and martial experience to outlast almost any foe.
   - A **Ranger** stalking the deep forests with a readied bow detects predators before being seen, opens with a lethal arrow, and slaughters their chosen Favored Enemy—Wait for an ambush in cramped ruins without preparation, however, and the Ranger is fragile.
   - A **Cleric** faces tougher, slower battles against ordinary beasts and brigands, conserving strength between fights with **Divine Self-Healing**, yet steps into undead-haunted barrows and ruins as a terrifying specialist whose faith disrupts, weakens, and smites the unquiet dead.

---

## 2. The Three Survival Strategies

| Dimension | Fighter — *The Survivor* | Ranger — *The Hunter* | Cleric — *The Undead Hunter* |
| :--- | :--- | :--- | :--- |
| **Core Fantasy** | Seasoned man-at-arms and veteran of brutal melee | Keen-eyed wilderness stalker and apex tracker | Devout exorcist, tomb-cleanser, and enduring pilgrim |
| **General Direct Combat** | **Strongest** — reliable across almost every monster type | **Conditional** — powerful when prepared; fragile when surprised | **Weakest (Intentional)** — lower general damage against ordinary foes |
| **Primary Advantage** | Universal weapon/armor proficiency, physical durability, martial readiness | Early detection, **Opening Shot**, evasion, and lethal **Favored Enemy** focus | Out-of-combat **Divine Self-Healing** (expedition longevity) + **Undead Mastery** |
| **Monster Knowledge Domain** | Organized combatants, humanoids, goblinoids, orcs, trolls, giants | Natural ecosystems (animals, beasts, vermin, plants, fey, dragons) + chosen **Favored Enemy** | The Undead, necromancy, curses, corporeal/incorporeal horrors |
| **Failure Mode in Permadeath** | Overconfidence against high-tier attritional/magic threats or ignoring HP thresholds | Being ambushed (`SURPRISED`), fighting in melee without preparation, or failing to retreat | Exhausting sacred healing charges deep in the wilds or underestimating mundane apex brutes |

---

## 3. Critical Rule: Hidden Mathematics

To preserve dark-fantasy immersion and prevent players from treating Darkgrid as a spreadsheet optimization puzzle, **all underlying mathematical modifiers for attributes, class abilities, monster knowledge, and combat rolls remain hidden from the player UI.**

### 3.1 What Must NEVER Be Displayed to Players

Players must **never** see raw combat/stat bonuses or probabilities in character creation, level-up screens, equipment tooltips, HUD pillars, the Champion Record modal, or combat logs:

- ❌ `+3 Attack against Humanoids` or `+2 Attack / +3 Damage / +2 AC vs Undead`
- ❌ `+20% Monster Detection` or `Ambush threshold <= 2`
- ❌ `STR: 16 (+3)` or `Modifier = floor((stat - 10) / 2)`
- ❌ `71 Attribute Points Remaining` or `+ / -` numerical min-max point-buy spinners
- ❌ `+15% Critical Chance`, `19-20/x2`, or `+10% Combat XP per +1 INT mod`
- ❌ `Atk +4 • 1d8` on hand-slot badges or raw `AC 17` on the main HUD pillar
- ❌ `Heals 2d6 + 3 HP` on ability descriptions

### 3.2 What MUST Be Displayed Instead (Qualitative Atmospheric Feedback)

Every internal mechanic is communicated through clear, evocative English prose that conveys **what** the character is good at and **how** their capability has grown, without exposing the formula:

- ✅ *"Experienced against humanoid enemies and organized combatants."*
- ✅ *"Highly perceptive in the wilderness; rarely caught unaware."*
- ✅ *"Your faith strengthens your strikes and shields your soul against the undead."*
- ✅ *"Your endurance has improved."*
- ✅ *"Seasoned with all blades, bows, and hafted weapons."*
- ✅ *"Heavily armored and protected by a raised shield."*
- ✅ *"You recognize the familiar stance of a hardened orc warrior."*

### 3.3 Mandatory Transparency Exceptions (Fair Permadeath Rule)

Hiding combat formulas must **never** deprive the player of tactical resource awareness required to make fair life-or-death decisions in a permadeath game. The following tactical resources remain **explicitly numerical and visible**:

| Resource / Metric | Player Visibility | Rationale |
| :--- | :--- | :--- |
| **Hit Points (`Current HP / Max HP`)** | **Visible** (e.g., `HP 28 / 34`) | Essential for judging whether to fight, drink a potion, pray, or flee in a permadeath system. |
| **Character Level & Class** | **Visible** (e.g., `Level 4 Ranger`) | Core progression milestone and world threat anchor. |
| **Experience Progress (`XP / Next Level XP`)** | **Visible** (progress bar / milestone counter) | Communicates expedition advancement toward the next level milestone. |
| **Gold Coins** | **Visible** (exact integer) | Required for town market, rest, and bounty transactions. |
| **Consumable & Ammo Counts** | **Visible** (e.g., `Healing Potion x2`, `Arrows x18`) | Concrete physical inventory items that run out. |
| **Cleric Divine Self-Healing Charges** | **Visible** (e.g., `Sacred Prayers: 2 / 3 remaining`) | Primary expedition pacing resource between city visits; exact heal roll formula (`2d6 + WIS`) is hidden, but remaining charges and the resulting HP restored after praying are shown. |
| **Fighter Second Wind Readiness** | **Visible** (e.g., `Second Wind: Ready` / `Spent`) | Binary tactical emergency state per encounter. |

---

## 4. Audit of Existing Numerical Leaks in Post-Phase-6.2 UI (`042d122`)

An inspection of the current codebase reveals specific locations where raw internal math is currently exposed to the player and must be converted to qualitative descriptions during Phase 7B:

1. **[`action-ui-lab/server/services/legacy-compatibility-service.js`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/server/services/legacy-compatibility-service.js#L377-L458) (`buildClassAbilitySummary`):**
   - Currently emits strings such as `"+1 Attack & +1 Damage with all weapons."`, `"+1 Armor Class when wearing armor."`, `"Gain +2 Attack & +2 Damage against your chosen Favored Enemy."`, and `"+2 Attack, +3 Damage, +2 AC vs Undead."`
   - **Phase 7A.2 Remediation:** Replace all summary strings with the approved qualitative progression descriptions defined in [`PHASE-7A2-CLASS-PROGRESSION.md`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/docs/phase-7a2/PHASE-7A2-CLASS-PROGRESSION.md).
2. **[`action-ui-lab/public/js/character/character-ui.js`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/public/js/character/character-ui.js#L82-L120) (Hand Slot & HUD Pillar Labels):**
   - Currently renders `Atk +4 • 1d8` on main-hand weapon slots, `+2 Shield AC` on off-hand shields, and raw `AC` integer in `#hud-ac-val`.
   - **Phase 7A.2 Remediation:** Display qualitative weapon/stance readiness on hand slots (e.g., *"Masterwork Longsword • Readied"*, *"Heavy Oak Shield • Guarded"*) and replace raw HUD AC with a qualitative **Protection / Guard** descriptor (e.g., *Unarmored*, *Lightly Guarded*, *Armored*, *Heavily Fortified*, *Ironclad*).
3. **[`action-ui-lab/public/js/character/character-ui.js`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/public/js/character/character-ui.js#L290-L362) (`openCharacterModal` — Champion Record):**
   - Currently displays raw attribute integers and modifiers (`STR: 16 (+3)`), raw save numbers (`Fortitude +4`), and raw passive formulas (`+10% Combat XP per +1 INT mod`, `-5% Shop Price per +1 CHA mod`, `+2 Belt of Giant Strength Active`).
   - **Phase 7A.2 Remediation:** Render descriptive attribute tiers (e.g., *Strength: Mighty*, *Constitution: Tough*, *Wisdom: Devout*) and qualitative resilience/training notes, keeping exact numbers internal to the server state and developer/diagnostic logs.
4. **[`action-ui-lab/public/js/character/character-ui.js`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/public/js/character/character-ui.js#L679-L832) (`openCreateCharacterModal` — Character Forge):**
   - Currently uses a 71-point raw numerical point-buy allocator (`STR 10..18`, `Mod +0..+4`).
   - **Phase 7A.2 Remediation:** Replace with the **Descriptive Calling & Trait Allocation** flow specified in [`PHASE-7A2-CHARACTER-CREATION.md`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/docs/phase-7a2/PHASE-7A2-CHARACTER-CREATION.md).

---

## 5. Deterministic Internal Engine Integrity

Hiding numbers from the player **never** means making the backend vague or arbitrary:

- All server-side calculations in [`src/domain/character/rules.js`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/src/domain/character/rules.js), [`src/domain/combat/rules.js`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/src/domain/combat/rules.js), [`src/domain/combat/engine.js`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/src/domain/combat/engine.js), and [`src/domain/encounters/engine.js`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/src/domain/encounters/engine.js) remain strictly deterministic, integer-based, and unit-tested.
- Every qualitative description maps `1:1` to an explicit, version-controlled numerical table in `src/config/index.js`.
- Server-side truth (`.agents/rules/darkgrid_rules.md`) is strengthened: the client UI does not even need raw modifier formulas to render the character sheet, as the server state payload can supply pre-resolved qualitative descriptors alongside authoritative HP, XP, gold, and charge counts.
