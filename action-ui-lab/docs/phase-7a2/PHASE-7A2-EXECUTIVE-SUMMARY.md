# DARKGRID — PHASE 7A.2: EXECUTIVE SUMMARY & OWNER DECISION CHECKLIST

> [!IMPORTANT]
> **Historical Design Baseline (Superseded by Phase 7A.3):** This Phase 7A.2 document is preserved as historical design context. For the authoritative Phase 7B specification—including natural Ranger `monster_family` classifications, free 72-point attribute allocation (`8–18`), Battle Experience (`INT` damage / `WIS` AC), Fighter *Second Wind Lethal Rescue*, and natural habitat preservation—see [`../phase-7a3/PHASE-7A3-EXECUTIVE-SUMMARY.md`](../phase-7a3/PHASE-7A3-EXECUTIVE-SUMMARY.md).

**Date:** 2026-10-22  
**Phase:** 7A.2 — Class Identity & Thematic Progression (Design & Documentation Only)  
**Verified Baseline:** `main` commit `042d122` (Post-Phase-6.2 Source of Truth)  
**Deliverables Directory:** [`action-ui-lab/docs/phase-7a2/`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/docs/phase-7a2/)

---

## 1. Executive Summary

Phase 7A.2 overhauls the Phase 7A.1 balance proposal around a single guiding directive:

> **"Make the classes different, not equal."**

Instead of forcing **Fighter**, **Ranger**, and **Cleric** into a narrow $\le 8\text{ percentage-point}$ win-rate spread across all monsters—which previously pushed the Ranger toward generic doctrines and turned the Cleric into a mid-combat self-healing tank—Phase 7A.2 establishes **three asymmetric survival experiences** backed by **Hidden Mathematics** and **Approved Option A (Automatic Class Monster Knowledge)**:

1. **Fighter — *The Survivor*:**
   - The strongest general-purpose combatant across all 98 monsters (`d10` HD, full martial attack progression, proficiency with **all** weapons, armor, and shields).
   - Progresses through five signature abilities: **Battle-Hardened**, **Weapon Mastery**, **Know Your Enemy**, **Armor Mastery**, and **Second Wind**.
   - **Monster Expertise (*Know Your Enemy*):** Automatically unlocks Stage 1 & 2 tactical encounter intelligence and hidden offensive/defensive bonuses against **25 Martial, Humanoid, and Giant** foes (all 17 `Humanoid` monsters—including `Ogre` and `Troll` (`giant`)—plus 8 armed `Monstrous Humanoid`/`Fey (gnome)` combatants like `Minotaur`, `Yeti`, `Gargoyle`, and `Spriggan`), without relying on humanoid encounters to feel strong.
2. **Ranger — *The Hunter*:**
   - A wilderness specialist who is lethal when prepared and vulnerable when surprised (`d8` HD, light/medium armor).
   - **Restored Single Favored Enemy:** Rejects the Phase 7A.1 "Three Broad Doctrines" and restores the personal choice of **ONE Favored Enemy** at character creation from **7 curated, well-represented categories** grounded in the 98-monster database (preserving meaningful Humanoid subtype groupings and strictly prohibiting Undead).
   - Progresses through five signature abilities: **Favored Enemy**, **Opening Shot** (strictly requiring `DISCOVERED` + prepared ranged weapon, capable of killing prey before Round 1 with full XP/loot/bounty resolution), **Wilderness Instinct**, **Hunter's Knowledge** (covering 61 natural wilderness creatures), and **Evasive Retreat**.
3. **Cleric — *The Undead Hunter*:**
   - **Intentionally the weakest direct combatant** against ordinary beasts and humanoids (three-quarter attack progression, no general weapon mastery bonus).
   - **Restored Out-of-Combat Healing Philosophy:** Rejects repeatable in-combat self-healing and restores **Divine Self-Healing** as an **out-of-combat** expedition recovery prayer (`2` charges at L1, `3` at L5, `4` at L9; `1d6 + WIS_mod` scaling to `5d6 + WIS_mod`, recharged only in a city). This enables the Cleric to sustain longer expeditions and start encounters at high or full HP.
   - **Undead Specialist:** Against all **12 Undead monsters**, **Undead Knowledge**, **Sacred Strike**, **Turn Undead**, and **Holy Protection** combine to make the Cleric the undisputed specialist against corporeal, incorporeal (`Shadow`, `Wraith`), and curse-bearing (`Mummy`, `Wight`, `Draugr`) undead.
4. **Hidden Mathematics & Descriptive Progression:**
   - All internal calculations remain deterministic (`modifier = floor((attribute - 10) / 2)`, `+1` attribute at Levels 2, 4, 6, 8, and 10), but player-facing UI replaces raw `+X` combat bonuses and point-buy numbers with atmospheric descriptions (*Strong*, *Tough*, *Agile*, *Perceptive*, *Wise*, *Commanding*).
   - Tactical permadeath resources (**Current/Max HP**, **Level**, **XP progress**, **Gold**, **Potions/Ammo**, and **Cleric Prayer Charges**) remain explicitly visible.
5. **Mandatory Retroactive Constitution Rule:**
   - Whenever `CON` modifier changes by $\Delta M_{\text{con}}$ at Level $L$, `Max HP` adjusts by $L \times \Delta M_{\text{con}}$ across every character level, and `Current HP` adjusts by the exact same delta (capped at `Max HP`, **never** full-healing missing HP).

---

## 2. Key Design Trade-Offs (Explicit & Intentional)

1. **Ordinary Fights Are Harder for Clerics:** A Cleric fighting an *Owlbear*, *Troll*, or *Manticore* will take more rounds and lose more HP than a Fighter. The Cleric compensates by entering that fight at 100% HP via pre-combat **Divine Self-Healing**, drinking potions if necessary during combat, and dominating every Undead encounter in the game.
2. **Rangers Must Respect Preparation:** A Ranger who marches into ruins with a melee weapon in hand or gets ambushed (`SURPRISED`) loses **Opening Shot** and feels noticeably more fragile than a Fighter. However, a Ranger who scouts ahead with a bow readied can eliminate skirmishers before Round 1 and slaughter their chosen **Favored Enemy**.
3. **Hidden Math Requires Rich Qualitative Feedback:** Because players will no longer see `STR 16 (+3)` or `+2 Attack vs Orcs`, the UI and combat log must clearly communicate *why* a character is succeeding (through qualitative tier labels like *Mighty* / *Iron-Blooded* and combat recognition lines like *"You recognize the familiar stance of a hardened orc warrior"*).

---

## 3. Complete Index of Phase 7A.2 Deliverables

1. [`PHASE-7A2-DESIGN-PHILOSOPHY.md`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/docs/phase-7a2/PHASE-7A2-DESIGN-PHILOSOPHY.md) — Core philosophy ("different, not equal") and Hidden Mathematics rules.
2. [`PHASE-7A2-CLASS-IDENTITIES.md`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/docs/phase-7a2/PHASE-7A2-CLASS-IDENTITIES.md) — Deep dive into Fighter, Ranger, and Cleric roles, equipment, and survival strategies.
3. [`PHASE-7A2-CLASS-PROGRESSION.md`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/docs/phase-7a2/PHASE-7A2-CLASS-PROGRESSION.md) — Level 1–10 tables with hidden internal mechanics and English player-facing descriptions.
4. [`PHASE-7A2-MONSTER-KNOWLEDGE.md`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/docs/phase-7a2/PHASE-7A2-MONSTER-KNOWLEDGE.md) — Approved Option A specification and the **Complete 98-Monster Classification Matrix**.
5. [`PHASE-7A2-CHARACTER-CREATION.md`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/docs/phase-7a2/PHASE-7A2-CHARACTER-CREATION.md) — Descriptive character creation, hidden attribute tiers, and the Retroactive Constitution & HP Rule.
6. [`PHASE-7A2-SIMULATION-REVISION.md`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/docs/phase-7a2/PHASE-7A2-SIMULATION-REVISION.md) — Removal of equal-win-rate Gate G2 and specification of the 10 thematic verification criteria.
7. [`PHASE-7A2-PHASE7B-ROADMAP.md`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/docs/phase-7a2/PHASE-7A2-PHASE7B-ROADMAP.md) — Post-Phase-6.2 verification (`042d122`), retired Phase 7A.1 proposals, and 6-stage Phase 7B implementation plan.
8. [`PHASE-7A2-EXECUTIVE-SUMMARY.md`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/docs/phase-7a2/PHASE-7A2-EXECUTIVE-SUMMARY.md) — This summary and owner decision checklist.

---

## 4. Unresolved Questions / Decisions for Owner Approval Before Phase 7B

All major architectural and philosophical questions have been resolved by the Phase 7A.2 specification. Only **three small tuning/UX confirmations** remain before starting Phase 7B implementation:

1. **Ranger Favored Enemy Granularity (7 Curated Groupings vs. Finer Subtype Split):**
   - In [`PHASE-7A2-MONSTER-KNOWLEDGE.md`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/docs/phase-7a2/PHASE-7A2-MONSTER-KNOWLEDGE.md), we proposed **7 curated Favored Enemy choices** (`Goblinoids & Orc Raiders [6]`, `Gnolls, Reptilians & Giants [11]`, `Beasts & Predators (Animals) [12]`, `Magical Beasts & Apex Monsters [22]`, `Arachnids, Vermin & Deadly Flora [13]`, `Monstrous Humanoids, Fey & Drakes [12]`, `Aberrations & Unnatural Horrors [10]`) so that even small subtype families (`2` Orcs, `2` Gnolls, `2` Giants) are bundled into meaningful 6-to-22 monster hunting domains.
   - **Question:** Do you approve these 7 curated Favored Enemy choices, or would you prefer `Goblinoids`, `Orcs`, `Gnolls`, `Reptilians`, and `Giants` to remain separate standalone dropdown choices despite some having only 2–4 monsters in the 98-monster roster?
2. **Level-Up Attribute Growth UX (Single `+1` Step at L2/4/6/8/10 vs. Descriptive Milestone Breakthroughs):**
   - Under `modifier = floor((attribute - 10) / 2)`, a `+1` attribute increase at Level 2 moves an even starting attribute (`16`) to an odd score (`17`, still `+3` modifier) until a second `+1` is invested at Level 4 (`18`, `+4` modifier).
   - In [`PHASE-7A2-CHARACTER-CREATION.md`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/docs/phase-7a2/PHASE-7A2-CHARACTER-CREATION.md), we handle this transparently with descriptive text (*"Honing toward Herculean"* on the odd step, followed by a tier breakthrough on the even step).
   - **Question:** Do you want to keep the `+1` per even level (`L2, 4, 6, 8, 10`) with this two-step descriptive honing feedback, or would you prefer each chosen descriptive training milestone (e.g., at `L3, L6, L9`) to grant a full `+2` (+1 modifier tier) immediately so every choice produces an immediate mechanical change?
3. **Surface Habitat Expansion for the 10 Underground-Only (`U`) Monsters:**
   - Currently, 10 of the 98 monsters (`Darkmantle`, `Mummy`, `Iron Cobra`, `Skeletal Champion`, `Duergar`, `Drow`, `Cloaker`, `Phase Spider`, `Morlock`, plus coastal `Giant Crab` and `Sahuagin`) only spawn on `U` (`UNDERGROUND_RUINS` at `(9,7)` in sandbox) or coastal tiles because canonical `001_seed_world.sql` uses surface codes `F, H, P, S, J, T`.
   - **Question:** In Phase 7B, should we append thematic surface ruin/swamp/hill habitat codes to those monsters (e.g., allowing `Skeletal Champion` and `Mummy` to haunt surface Ruins `T`/`H` and `Phase Spider` in deep Forests/Jungles `F`/`J`) so Clerics and Rangers encounter all 98 monsters across the overworld?
