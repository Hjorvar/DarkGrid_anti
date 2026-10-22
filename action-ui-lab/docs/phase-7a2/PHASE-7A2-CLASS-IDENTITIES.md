# DARKGRID — PHASE 7A.2: CLASS IDENTITIES & PLAYSTYLE DISTINCTIONS

**Date:** 2026-10-22  
**Phase:** 7A.2 — Class Identity & Thematic Progression (Design & Documentation Only)  
**Baseline Verified Against:** `main` commit `042d122`

---

## 1. Overview of Class Asymmetry

Darkgrid features three playable classes whose identities are defined by **how they survive a hostile permadeath world**, not by symmetrical damage-per-round formulas:

1. **Fighter — *The Survivor*:** The strongest general-purpose combatant. Survives through superior physical durability, mastery of every weapon and armor type, emergency grit in battle, and veteran tactical insight against humanoid and martial foes.
2. **Ranger — *The Hunter*:** The wilderness specialist and apex stalker. Survives by detecting threats first, striking from afar before melee begins, reading the natural ecosystem, evading deadly pursuits when forced to flee, and ruthlessly eliminating a personally chosen **Favored Enemy**.
3. **Cleric — *The Undead Hunter*:** The enduring pilgrim and sacred exorcist. Intentionally the weakest direct combatant against ordinary beasts and brigands, but survives long expeditions through out-of-combat **Divine Self-Healing** and dominates encounters against the **Undead**.

---

## 2. FIGHTER — THE SURVIVOR

### 2.1 Core Identity & Fantasy
The Fighter is a hardened veteran of border wars, mercenary companies, and brutal close-quarters survival. Where a Ranger relies on ambush and a Cleric relies on prayer, the Fighter relies on steel, conditioning, and martial discipline.

- **General Combat Reliability:** Highest in the game. A Fighter is never "out of their element" in a stand-up fight, whether facing a Dire Boar, an Owlbear, an Ogre, or a Skeletal Champion.
- **Equipment Mastery:** Proficient with **ALL weapons** (melee and ranged—longswords, battleaxes, greatswords, warhammers, longbows, crossbows) and **ALL armor and shields** (from leather to full plate and tower shields).
- **Physical Durability:** Largest base hit die (`d10`), innate physical toughness (**Battle-Hardened**), and superior armor utilization (**Armor Mastery**).
- **In-Combat Grit:** Retains **Second Wind** as an automatic emergency combat recovery trigger when pushed to critical health, allowing the Fighter to survive a sudden brutal exchange that would kill a less durable class.

### 2.2 Fighter Monster Expertise: *Know Your Enemy*
While effective against all creatures, a Fighter possesses deep, practical experience fighting **organized combatants, martial enemies, and giant-kin**. A Fighter reads weapon reach, shield habits, formation discipline, and the telegraphed swings of massive brutes.

- **Thematic Scope:**
  - Goblinoids (*Goblin, Hobgoblin, Bugbear, Hobgoblin Captain*)
  - Orcs (*Orc, Orc Warchief*)
  - Gnolls (*Gnoll, Gnoll Packmaster*)
  - Armed Reptilian & Tribal Humanoids (*Kobold, Lizardfolk, Troglodyte, Boggard, Grippli Scout, Duergar, Drow*)
  - Giants & Hulking Brutes (*Ogre, Troll, Minotaur, Yeti, Spriggan*)
  - Martial Monstrous Humanoids & Armed Garrison Threats (*Sahuagin, Doppelganger, Gargoyle, Harpy, Morlock*)
- **Design Guardrail:** The Fighter's base **Weapon Mastery**, **Armor Mastery**, and **Battle-Hardened** progression ensure the class remains the strongest general-purpose combatant against *all* 98 monsters. **Know Your Enemy** provides an additional automatic edge against martial/humanoid foes without making the Fighter dependent on humanoid encounters to feel powerful.

### 2.3 Fighter Strengths & Weaknesses
- **Strengths:**
  - Highest HP pool and highest effective Armor Class across all levels.
  - Unmatched weapon flexibility: can swap seamlessly between a heavy two-handed blade, sword-and-board, or a heavy bow.
  - Consistent accuracy and damage against every creature type.
  - Automatic offensive and defensive edge against humanoids, giants, and martial foes.
  - Automatic emergency **Second Wind** recovery once per battle when badly wounded.
- **Weaknesses:**
  - Standard wilderness awareness: far more likely than a Ranger to walk into an ambush (`SURPRISED`) or fail to identify a camouflaged predator (`Assassin Vine`, `Cloaker`, `Ankheg`) at a distance.
  - No out-of-combat self-healing skill: must rely on town rest, camp rations/potions, and high armor mitigation to manage HP across long expeditions.
  - Lacks sacred disruption against incorporeal or curse-wielding undead (`Shadow`, `Wraith`, `Mummy`), relying instead on raw martial force and magic/silvered weaponry.

---

## 3. RANGER — THE HUNTER

### 3.1 Core Identity & Fantasy
The Ranger is a solitary tracker, border scout, and master of the wilds. The wilderness is not an obstacle to the Ranger—it is a readable book of broken twigs, disturbed carrion, wind direction, and territorial markings.

- **Preparedness vs. Vulnerability:** When the Ranger spots the quarry first (`DISCOVERED`) with a bow strung, the fight is often decided before the monster closes to melee range. When caught off-guard (`SURPRISED`) in tight quarters or forced into a protracted slugging match with a heavily armored brute, the Ranger's lighter armor (`d8` hit die, light/medium armor preference) makes every hit dangerous.
- **Wilderness Awareness:** Through **Wilderness Instinct**, the Ranger spots monsters earlier, avoids ambushes that trap Fighters and Clerics, and tracks wounded persistent monsters across tiles.
- **Ecological Insight:** Through **Hunter's Knowledge**, the Ranger automatically reads the behavior, hunting patterns, and danger signs of animals, magical beasts, vermin, dangerous flora, fey, and dragons—plus their chosen Favored Enemy.
- **Survival Through Disengagement:** When an encounter turns sour, **Evasive Retreat** makes the Ranger substantially more adept at breaking contact and surviving a tactical retreat (`FLEE`).

### 3.2 Favored Enemy (Restored Original Design Philosophy)
Phase 7A.2 **rejects** the Phase 7A.1 "Three Broad Hunter Doctrines" proposal and **restores the classic Darkgrid rule**:

> **During character creation, the Ranger selects ONE personal Favored Enemy specialization.**

- That choice defines the Ranger's personal history and hunting obsession.
- As the Ranger levels up (Levels 1 → 3 → 5 → 7 → 9 → 10), their automatic offensive, defensive, and critical/precision advantages against their chosen Favored Enemy grow dramatically.
- **Undead Restriction Preserved:** Rangers study living ecologies and mortal quarry; **Undead cannot be selected as a Ranger Favored Enemy** (that domain belongs exclusively to the Cleric).
- **Curated, Well-Represented Selection:** Grounded in the 98-monster database, every Favored Enemy option has meaningful world representation, and Humanoid options preserve meaningful subtype/cultural groupings (see [`PHASE-7A2-MONSTER-KNOWLEDGE.md`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/docs/phase-7a2/PHASE-7A2-MONSTER-KNOWLEDGE.md) for the complete breakdown).

### 3.3 Opening Shot (Strict Conditions Preserved)
**Opening Shot** is the Ranger's signature combat initiation mechanic, governed by strict tactical rules:
1. **Requires a Prepared Ranged Weapon:** The Ranger must have a ranged weapon (`ranged` category or bow/crossbow) equipped in the active main hand.
2. **Requires Successful Detection & Player Initiation:** The encounter must be in `DISCOVERED` state (the Ranger detected the monster before it attacked) and the Ranger initiates combat (`ENGAGE` or ranged strike).
3. **Never Triggers on Ambush:** If the monster ambushes the Ranger (`SURPRISED` / `AMBUSHER`), Opening Shot does **not** occur.
4. **Lethal Opening Shot Support:** If the Opening Shot reduces the monster to `0 HP` before Round 1 begins, the combat engine immediately resolves a full **Victory**—awarding full XP, generating monster loot, clearing/updating persistent monster state, and crediting active bounties (already wired in [`src/domain/combat/engine.js`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/src/domain/combat/engine.js) and [`action-ui-lab/server/controllers/combat-controller.js`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/action-ui-lab/server/controllers/combat-controller.js#L40-L56)).

### 3.4 Ranger Strengths & Weaknesses
- **Strengths:**
  - Best encounter detection and lowest ambush rate in the game (**Wilderness Instinct**).
  - Free pre-combat ranged attack (**Opening Shot**) when prepared and initiating from stealth/discovery.
  - Devastating, scaling lethality against their chosen **Favored Enemy**.
  - Automatic Stage 1 & Stage 2 ecological intelligence (**Hunter's Knowledge**) against all natural/wilderness creatures and their Favored Enemy.
  - Highest success rate and lowest damage taken when fleeing (**Evasive Retreat**).
- **Weaknesses:**
  - Lower HP and lighter armor than the Fighter; vulnerable in prolonged toe-to-toe attrition against non-favored heavy hitters.
  - Loses **Opening Shot** if ambushed or if caught with a melee weapon equipped when initiating.
  - No innate self-healing skill; relies on avoiding damage through detection, pre-combat alpha strikes, and timely retreats.

---

## 4. CLERIC — THE UNDEAD HUNTER

### 4.1 Core Identity & Fantasy
The Cleric is a vowed servant of sacred light walking through a cursed, corpse-strewn world. In Darkgrid, **the Cleric is intentionally the weakest direct combatant against ordinary monsters.**

A Cleric is not a paladin or a holy Fighter. When a Cleric fights a Wolf, an Ogre, or a Manticore, the battle is slower, harder, and more taxing than it would be for a Fighter or a prepared Ranger. The Cleric's power lies in two pillars that no other class can replicate:

1. **Between-Battle Recovery (*Divine Self-Healing*):** While a Fighter or Ranger is forced to limp back to town or burn expensive potions after two bruising skirmishes, the Cleric kneels in prayer after combat, restores lost vitality using sacred charges, and **enters the next encounter at high or full HP**.
2. **Absolute Mastery Over the Undead:** When the air turns freezing and a *Shadow*, *Wight*, *Draugr*, *Skeletal Champion*, or *Mummy* rises from a barrow, the Cleric transforms from the weakest combatant into an apex specialist.

### 4.2 Cleric Healing Philosophy: Out-of-Combat Expedition Endurance
Phase 7A.2 **rejects** the Phase 7A.1 proposal to turn Divine Self-Healing into a repeatable in-combat heal with expanded `3 + WIS_mod` daily charges. Instead, it **restores and refines the original Darkgrid healing philosophy**:

- **Out-of-Combat Only:** **Divine Self-Healing** can only be invoked outside of active combat (implemented and enforced in [`src/domain/character/rules.js`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/darkgrid_phase7a_balance_audit/src/domain/character/rules.js#L261-L320) via `performClericSelfHeal`). During active combat rounds, a Cleric who needs emergency healing must drink a physical potion just like any other class.
- **Strict Charge Economy Recharged in Cities:**
  - **Levels 1–4:** `2` charges per city rest.
  - **Levels 5–8:** `3` charges per city rest.
  - **Levels 9–10:** `4` charges per city rest.
  - Charges recharge **only** when resting in a city (`performCityRest`), preserving strategic tension on deep wilderness expeditions.
- **Scaling Healing Dice + Wisdom Modifier:**
  - **Levels 1–2:** `1d6 + WIS_mod` (min `1`)
  - **Levels 3–4:** `2d6 + WIS_mod`
  - **Levels 5–6:** `3d6 + WIS_mod`
  - **Levels 7–8:** `4d6 + WIS_mod`
  - **Levels 9–10:** `5d6 + WIS_mod`
  - *Evaluation:* At `2` to `4` charges per expedition, this scaling restores roughly `1.5×` to `2.2×` of the Cleric's total Max HP bar across an entire trip outside town—enough to sustain a significantly longer expedition and start key fights at full health, without granting infinite recovery.

### 4.3 Cleric Monster Expertise: *Undead, Necromancy, and Curses*
The Cleric's combat specialization is focused squarely on **Undead** (`creature_type = UNDEAD` and necromantic/curse hazards):
- **Undead Knowledge:** Automatically reveals detailed Stage 1 and Stage 2 intelligence on all Undead—identifying corporeal vs. incorporeal nature, paralysis touch, energy drain, mummy rot curses, and damage resistances.
- **Sacred Strike:** Automatically empowers the Cleric's weapon attacks and damage against Undead, bypassing or mitigating unholy resilience.
- **Turn Undead:** Automatically disrupts Undead at the start of and during combat—causing hesitation, awe, weakened attack accuracy, or suppressed supernatural tempo.
- **Holy Protection:** Automatically shields the Cleric against Undead attacks, paralysis, rot/filth diseases, necrotic energy drain, and incorporeal touch.
- **Strict Boundary:** Full Undead specialization bonuses apply **only** to Undead (and necromantic/curse effects)—they are **not** automatically extended to all Outsiders or Aberrations.

### 4.4 Cleric Strengths & Weaknesses
- **Strengths:**
  - **Divine Self-Healing** between battles enables the longest self-sustained expeditions and ensures the Cleric frequently starts encounters at full HP.
  - Dominant specialist against all 12 Undead monsters (`Human Skeleton`, `Human Zombie`, `Plague Zombie`, `Ghoul`, `Skeletal Champion`, `Ghast`, `Shadow`, `Wight`, `Draugr`, `Mummy`, `Wraith`, `Barrow Wight`), including dangerous incorporeal and curse-bearing foes that terrify Fighters and Rangers.
  - Strong willpower and resistance against paralysis, fear, curses, and life-drain.
- **Weaknesses:**
  - **Intentionally weakest general direct combatant:** lower base attack and weapon damage against ordinary living monsters (`Animal`, `Magical Beast`, `Humanoid`, `Monstrous Humanoid`, `Aberration`).
  - Restricted weapon traditions (blunt/simple/sacred armaments rather than martial greatswords or longbows) and lacks the Ranger's pre-combat ranged Opening Shot.
  - Once out-of-combat prayer charges are expended far from town, the Cleric must rely on cautious routing to return alive.

---

## 5. Side-by-Side Playstyle Comparison Across the Game Loop

| Phase of Play | Fighter — *The Survivor* | Ranger — *The Hunter* | Cleric — *The Undead Hunter* |
| :--- | :--- | :--- | :--- |
| **Town Preparation** | Invests gold in the heaviest armor, shields, versatile melee/ranged weapons, and healing potions for expedition sustain. | Equips a quality bow, stocks arrows, selects hunting grounds matching their **Favored Enemy** or natural habitats. | Consecrates mace and shield, rests at the sanctuary to restore **Divine Self-Healing** charges, checks Undead bounties. |
| **World Travel & Detection** | Standard sight lines; relies on high AC and HP to weather unexpected encounters. | Superior **Wilderness Instinct** spots threats early (`DISCOVERED`) and reads tracks/danger signs before stepping onto lethal tiles. | Travels methodically; senses unholy presence and recognizes necromantic signs on barrows and ruins. |
| **Encounter Initiation** | Evaluates humanoid/martial foes with **Know Your Enemy**; engages confidently in melee or ranged exchange. | Inspects natural predators with **Hunter's Knowledge**; initiates with a lethal **Opening Shot** from a readied bow. | Reads Undead weaknesses via **Undead Knowledge**; invokes **Turn Undead** disruption and engages with **Sacred Strike**. |
| **Mid-Combat Crisis** | **Second Wind** automatically surges when HP drops low, keeping the Fighter standing to finish the foe. | Uses **Evasive Retreat** to slip away safely if an ambush or non-favored apex monster proves too dangerous. | Relies on **Holy Protection** against undead afflictions; against mundane brutes, must decide early whether to drink a potion or flee. |
| **Post-Combat Recovery** | Drinks potions or marches back toward town when cumulative chip damage wears down HP. | Takes minimal damage in prepared hunts due to **Opening Shot** kills; retreats to town when surprised or wounded. | Invokes **Divine Self-Healing** out of combat to restore full HP and continue exploring deeper into the grid. |
