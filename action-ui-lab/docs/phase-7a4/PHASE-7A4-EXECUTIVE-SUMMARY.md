# DARKGRID — PHASE 7A.4: EXECUTIVE SUMMARY

**Date:** 2026-10-22  
**Scope:** Phase 7A.4 — Final Owner Decisions, Design Corrections & Phase 7B Readiness Verdict  
**Status:** **100% LOCKED (Zero Open Design Questions Remaining)**  
**Deliverable Suite (`action-ui-lab/docs/phase-7a4/`):**
1. [`PHASE-7A4-FINAL-OWNER-DECISIONS.md`](./PHASE-7A4-FINAL-OWNER-DECISIONS.md) — Authoritative final record of all locked owner decisions (`OC-1` Option A, `OC-2` Option B, `OC-3` Option A, Equipment vs. Permanent CON rule, and preserved rules).
2. [`PHASE-7A4-FINAL-CONSISTENCY-AUDIT.md`](./PHASE-7A4-FINAL-CONSISTENCY-AUDIT.md) — Complete cross-document and codebase consistency audit (`UNDEAD = 11`, verified surface counts `88 / 87 / 86`, date corrections, and what changed from earlier documents).
3. [`PHASE-7A4-FINAL-PHASE7B-READINESS.md`](./PHASE-7A4-FINAL-PHASE7B-READINESS.md) — Definitive Phase 7B engineering specification, required code modifications, and automated test suite requirements.
4. [`PHASE-7A4-OWNER-DECISIONS.md`](./PHASE-7A4-OWNER-DECISIONS.md) — Master ledger of locked owner rules (`OD-7A4-01` through `OD-7A4-08`).
5. [`PHASE-7A4-RANGER-TAXONOMY.md`](./PHASE-7A4-RANGER-TAXONOMY.md) — 22-family taxonomy across all 98 monsters, Magical Beast classification (*"Other Magical Beasts"*), Option A 14-choice Character Creation list, and Option A Favored Enemy bonuses.
6. [`PHASE-7A4-LEVELS-AND-CONSTITUTION.md`](./PHASE-7A4-LEVELS-AND-CONSTITUTION.md) — Open-ended level progression and locked separation of Equipment CON vs. Permanent CON vs. Level-up HP rules.
7. [`PHASE-7A4-CONSISTENCY-REPORT.md`](./PHASE-7A4-CONSISTENCY-REPORT.md) — Detailed resolution of documentation and codebase discrepancies.
8. [`PHASE-7A4-PHASE7B-READINESS.md`](./PHASE-7A4-PHASE7B-READINESS.md) — Step-by-step Phase 7B implementation plan and test requirements.
9. [`PHASE-7A4-EXECUTIVE-SUMMARY.md`](./PHASE-7A4-EXECUTIVE-SUMMARY.md) — This summary.

---

## 1. Summary of Final Locked Owner Decisions

1. **`OC-1` Locked — Ranger Favored Enemy: Option A (`14` Initial Categories):**
   - Character Creation offers **14 initial Favored Enemy categories**: `ANIMALS`, `LUPINE_CANINE_BEASTS`, `AVIAN_CHIMERAS`, `TERRESTRIAL_MAGICAL_BEASTS` (**"Other Magical Beasts"**), `ARACHNIDS`, `VERMIN_INSECTS`, `DANGEROUS_PLANTS`, `DRAGONS_DRAKES`, `GOBLINOIDS`, `ORCS`, `GNOLLS`, `REPTILIAN_HUMANOIDS`, `TROLLS`, and `GIANTS`.
   - `FEY` and `AMPHIBIAN_HUMANOIDS` move to Reserved/Advanced (`Tier 2`).
   - `TROLLS`, `GIANTS`, and `DRAGONS_DRAKES` remain available at Character Creation.
   - `UNDEAD` (**`11` monsters**) is always strictly forbidden for Rangers (`RANGER_FAVORED_ENEMY_FORBIDDEN`).
   - Legacy Rangers remain backward-compatible.
   - **Magical Beast Classification:** Keeps the 3 families (`LUPINE_CANINE_BEASTS`, `AVIAN_CHIMERAS`, `TERRESTRIAL_MAGICAL_BEASTS`), with `TERRESTRIAL_MAGICAL_BEASTS` labeled **"Other Magical Beasts"** in the UI and no further biological sub-splits.
2. **`OC-2` Locked — Fighter Second Wind: Option B:**
   - `Level 1–2`: Not available.
   - `Level 3–5`: Tier I (`1d10 + Level + CON modifier`).
   - `Level 6–9`: Tier II (`2d10 + Level + CON modifier`).
   - `Level 10+`: Tier III (`3d10 + Level + CON modifier` + cleanse 1 physical status effect).
   - Automatic once per combat; preserves post-sequence multi-hit ordering, lethal HP rescue (`0 + heal`), DoT rescue, and `CALCIFY` petrification exclusion.
3. **`OC-3` Locked — Ranger Favored Enemy Bonuses: Option A:**
   - `Level 1–3`: `+2 Atk / +2 Dmg / 0 AC`.
   - `Level 4–7`: `+3 Atk / +3 Dmg / 0 AC`.
   - `Level 8`: `+4 Atk / +4 Dmg / 0 AC`.
   - `Level 9+`: `+4 Atk / +4 Dmg / +2 AC`.
   - No expanded Critical Hit range (`19–20`). Stacks with *Natural Knowledge* and INT/WIS *Battle Experience* (preserved at full strength without nerfs). Internal numbers remain hidden in the player UI.
4. **New Locked CON Rule — Equipment CON vs. Permanent CON vs. Level-Up:**
   - **Equipment CON:** Recalculates `Max HP` retroactively across all levels ($L \times M_{\text{con}}$), does **NOT** increase `Current HP` on equip, and clamps `Current HP` via $\text{newCurrentHp} = \max(1, \min(\text{oldCurrentHp}, \text{newMaxHp}))$ on all equip/unequip/swap operations (zero free healing; `1 HP` floor for living heroes).
   - **Permanent CON (Attribute Points):** Recalculates `Max HP` across all levels and increases `Current HP` by the exact same HP gain ($\Delta \text{HP} = L \times \Delta M_{\text{con}}$ when $\Delta M_{\text{con}} > 0$) without granting a full heal.
   - **Level-Up:** Adds the gained HP delta ($\Delta \text{MaxHP}_{\text{level}}$) to both `Max HP` and `Current HP` without a full heal.
   - **Login Reconciliation:** Updates `max_hp = MaxHP_canonical` and clamps `current_hp = max(1, min(oldCurrentHp, MaxHP_canonical))` without ever adding `+\Delta MaxHP` on login.
5. **No Maximum Character Level & Preserved Core Systems:**
   - Level 10 is **not** a maximum level, and no unapproved post-Level-10 milestones, abilities, or XP curves are invented.
   - Fighter *Know Your Enemy*, Ranger *Natural Knowledge*, Cleric *Sacred Knowledge*, INT/WIS *Battle Experience* (victories-only), class exemptions, permadeath, Monster `#36 Mummy` stats, and hidden UI numbers are preserved 100% intact.

---

## 2. Final Readiness Verdict

**VERDICT: 100% LOCKED AND READY FOR PHASE 7B IMPLEMENTATION.**
Zero open design decisions or document contradictions remain.
