# DARKGRID — TOP-DOWN EXPLORATION EXPERIMENT 1: SUMMARY (`TOPDOWN-EXPERIMENT-1-SUMMARY.md`)

## 1. Exact Location & How to Run the Game

- **Active Repository / Worktree:** `C:\Users\hih\.gemini\antigravity\worktrees\antiDark\topdown_exploration_experiment_one`
- **Git Safety Tag (Pre-Experiment Baseline):** `pre-topdown-experiment-1` (`970c6a2`, preserving the Phase 7C Action UI baseline)
- **Active Game Directory:** [`action-ui-lab/`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/topdown_exploration_experiment_one/action-ui-lab)
- **Server Entrypoint:** [`action-ui-lab/server.js`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/topdown_exploration_experiment_one/action-ui-lab/server.js)

### Quick Commands
```bash
# Start the active Action UI game server at http://localhost:3030
npm run start:lab
# or with nodemon auto-reload:
npm run dev:lab

# Run the Top-Down Exploration Experiment 1 automated integration & rules suite
node --test action-ui-lab/tests/topdown-experiment.test.js

# Run the Headless Chrome Visual QA & Screenshot suite
node action-ui-lab/tests/topdown-visual-qa.js

# Run the 244 baseline Darkgrid domain tests
npm test
```

---

## 2. What Was Changed

1. **Authoritative 8×7 Top-Down World & Quest Service ([`action-ui-lab/server/services/topdown-world-service.js`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/topdown_exploration_experiment_one/action-ui-lab/server/services/topdown-world-service.js)):**
   - Configured a cohesive **8×7 (56-tile)** world region (`x = 4..11`, `y = 1..7`) connecting **Oakhaven Sanctuary** (`[7, 7]`) with **Blackwood Forest (Goblin Forest)** and the fixed **Goblin Stronghold** landmark (`[7, 1]`).
   - Added multiple interconnected forest paths (Central Spine `[7,6] -> [7,1]`, Western Bypass Trail `[5,6] -> [5,2]` around `Stonefang Crag` `[6,5]`, and Eastern Bridge & Ravine Trail `[8,7] -> [9,7] -> [9,2]` around `Blackwater River` `[8,6]`).
   - Implemented **"The Goblin Chieftain"** quest with all four required states (`NOT_ACCEPTED`, `ACTIVE`, `COMPLETED`, `REWARD_CLAIMED`) and full support for the pre-acceptance boss kill edge case (if the player enters the forest and slays the boss before accepting the quest, the boss stays permanently dead and accepting the quest in Oakhaven immediately marks it `COMPLETED` for reward claim).
   - Seeded the persistent world boss **`Warchief Grak the Goblin Chieftain`** (`monster_instances` on `[7, 1]`) so the boss is a real world entity rather than a random encounter.
   - Implemented the Goblin Forest travel encounter selector (`selectGoblinForestMonster` & `checkGoblinForestEncounter`) with **80% Goblin-related monsters**, **15% Forest Animals**, and **5% Other Forest Monsters** from the existing database, with natural exploration pacing (not every step).

2. **Cohesive 2D Top-Down Dark-Fantasy Map Renderer ([`action-ui-lab/public/js/world/topdown-renderer.js`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/topdown_exploration_experiment_one/action-ui-lab/public/js/world/topdown-renderer.js)):**
   - Built an HTML5 Canvas 2D top-down renderer (`#topdown-map-canvas`) using reusable graphic primitives: layered pine and oak canopies, undergrowth bushes, jagged rock outcrops, shimmering river water, stone bridge masonry, Oakhaven timber roofs & warm sanctuary glow, Goblin Stronghold timber palisades, watchtower, spiked gate & flickering war-braziers, and a top-down Hero token with class-colored cloak, pauldrons, shield, and drawn blade.
   - Enforced **zero visible grid lines**, **zero emojis on the map**, **no visible roaming monsters**, and **~165ms smooth tile-to-tile interpolation** (`1 move = 1 tile`) via `WASD`, Arrow keys, on-screen cardinal buttons, or clicking any passable adjacent tile on the map.

3. **Simplified Exploration UI & Stronghold / Quest Integration:**
   - Updated [`action-ui-lab/public/index.html`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/topdown_exploration_experiment_one/action-ui-lab/public/index.html), [`action-ui-lab/public/css/world.css`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/topdown_exploration_experiment_one/action-ui-lab/public/css/world.css), [`action-ui-lab/public/js/ui/shortcuts.js`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/topdown_exploration_experiment_one/action-ui-lab/public/js/ui/shortcuts.js), [`action-ui-lab/public/js/world/navigation.js`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/topdown_exploration_experiment_one/action-ui-lab/public/js/world/navigation.js), [`action-ui-lab/public/js/world/scene-renderer.js`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/topdown_exploration_experiment_one/action-ui-lab/public/js/world/scene-renderer.js), and [`action-ui-lab/public/js/ui/modals.js`](file:///C:/Users/hih/.gemini/antigravity/worktrees/antiDark/topdown_exploration_experiment_one/action-ui-lab/public/js/ui/modals.js).
   - Expanded the top-down map to occupy **82% of the main workspace** in Player Mode while keeping only essential exploration readouts visible: Area Name, HP (Vitality), Healing Potions, short event/location description, `Hero [C]`, `Inventory [B]`, `Quests [J]`, `Shop [M]`, `Menu`, and the cardinal movement pad.
   - Added the **Goblin Stronghold Entrance** card at `[7, 1]` featuring Darkgrid stronghold gate artwork (`/images/terrain/terrain_town_gates.webp`), atmospheric description, and the **Challenge the Goblin Chieftain** button (`ENGAGE_STRONGHOLD_BOSS`).

---

## 3. What Old Exploration Functionality Was Replaced

- **Replaced First-Person POV / Relative Rotation Travel in Active Player Mode:**
  - Removed the static first-person perspective backdrop (`Scene Modes A / B / C / Legacy`), forward horizon portal, and relative rotation/strafe controls (`Forward / Turn 90° / Strafe`) from active exploration.
  - Replaced `W / A / S / D` and `Arrow Keys` with direct **top-down cardinal grid movement** (`North / West / South / East`, 1 step = 1 tile).
  - Hidden the redundant 5×5 minimap, FOV text strip, persistent bottom combat log during exploration, and multi-stat clutter from the default exploration view.

---

## 4. What Phase 7C Functionality Was Preserved Intact

- **Authentication & 72-Point Character Creation:** Login/registration, single living hero rule, and 72-point attribute allocation across `STR`, `DEX`, `CON`, `INT`, `WIS`, `CHA` (range `8–18`).
- **All 3 Classes & Phase 7C Class Abilities:**
  - **Fighter:** Heavy armor/weapons, d10 hit die, and **Second Wind** (automatic in-combat self-heal at $\le 40\%$ HP from Level 3+).
  - **Ranger:** 14-family **Favored Enemy** taxonomy (`+2` Attack & Damage vs chosen family, excluding Undead) and automatic **Opening Shot** before Round 1 when spotting an enemy with a ranged weapon.
  - **Cleric:** **Divine Charges** (`6 + Level + WIS mod`), **Battle Prayer** (1 charge: melee strike + `1d6 + WIS mod` heal), **Smite** (1 charge: `+2` Attack, `+1d6` damage, or `+2d6` vs Undead), **Divine Shield** (2 charges: `+2 AC` for 2 monster turns), out-of-combat Divine Heal prayers, and passive Holy Radiance vs Undead.
- **Combat Engine, Secrecy & Monster Artwork:** Stage 1 unidentified shadow threat (`Engage` or `Slip Past`), Stage 2 combat with large Darkgrid monster artwork, 9 qualitative health condition brackets, and hidden monster numbers.
- **Town Economy, Inventory & Equipment:** Free healing (`REST`) in Oakhaven, General Store & Global Resale Market (`BUY` / `SELL`), full equipment slots (`EQUIP` / `UNEQUIP`), weapon stance toggle (`MELEE` / `RANGED`), and Healing Potions (`POTION`).
- **Progression, Permadeath & Nemesis Persistence:** Canonical XP & Intelligence bonus, Level-up HP & milestone attribute points, permanent hero death (`FALLEN` memorial), 50% item transfer / 50% destruction, and persistent Nemesis monsters (`monster_instances`) with `+10%` HP boost and kill-count tracking.
