# Darkgrid Adventure Lab — Phase 3: Combat Presentation Report

**Date**: 2026-10-21  
**Scope**: `action-ui-lab/` (`public/css/combat.css`, `public/css/world.css`, `public/css/responsive.css`, `public/js/combat/combat-ui.js`, `public/js/combat/fx.js`, `public/js/combat/sequence.js`, `public/js/world/scene-renderer.js`)

---

## 1. Executive Summary

Phase 3 elevates the visual presentation of encounters and combat in **Darkgrid Adventure Lab** (`action-ui-lab/`) while strictly preserving all underlying combat rules, dice formulas, HP/AC/damage values, and class abilities.

Key presentation improvements delivered in Phase 3:
1. **State-Aware Environment vs. Monster Balance**: Explicit viewport framing classes (`scene-state-exploration`, `scene-state-discovered`, `scene-state-combat`, `scene-state-victory`) adjust scene focal zoom (`transform` on `.fp-scene-backdrop`) and peripheral atmospheric vignetting (`.fp-atmosphere-layer`) so the landscape leads during exploration while the monster commands center stage during combat.
2. **Anatomical Grounding & Airborne Separation**:
   - Grounded monsters (both Integrated RGBA cutouts and Card-fallback portraits) anchor to the perspective trail floor (`stageFloorY`, `groundSinkPx`, and anatomical `.fp-rig-contact-patch` / `.fp-rig-ambient-patch` shadows).
   - Flying creatures (`Stirge`, `Harpy`, `Manticore`, `Wyvern`, `Gargoyle`, `Vulture`) hover at calculated altitude above the floor with a detached, diffused ground shadow.
3. **GPU-Safe Combat Entry (`monsterEmergeFromMist`)**: Smooth distant-to-melee emergence driven by `computeEncounterDistanceTransition` (`--approach-start-scale`, `--approach-start-y`, `--approach-duration`) using pure `transform` and `opacity` (zero animated `filter`, preventing software-rasterizer tile invalidation in headless Chromium).
4. **Restrained, Readable Combat Feedback**:
   - Distinct animations for Hero Hit (`anim-monster-hit`), Critical Hit (`anim-monster-crit-hit` + `.slash-svg.is-crit-striking`), Miss/Evade (`anim-monster-dodge`), Monster Lunge (`anim-monster-lunge`), Damage Taken (`flash-blood` + `shake-damage`), and Monster Defeat (`anim-monster-defeat` collapse).
   - **Last-Exchange Readability Banner (`#seq-exchange-banner`)**: Single-line summary inside `.fp-monster-hud-plate` showing the exact outcome of the latest exchange (Hit, Critical Hit, Miss, Damage Dealt/Taken, Evaded Counterattack, or Victory) without duplicating log lines.
5. **Cohesive Victory & Return Transition (`.is-victory-remains`)**: Slain monsters with verified RGBA cutouts remain grounded in the scene in a subdued defeated state (`grayscale(0.52) brightness(0.78) scale(0.92)`) instead of snapping back to an arbitrary square card, and any movement key (`[W/S/Q/E]`) or `[Space]` returns seamlessly to exploration.

---

## 2. State-by-State Visual Balance

| Game State | Viewport State Class | Backdrop Framing (`transform`) | Peripheral Atmosphere | Primary Visual Focus |
| :--- | :--- | :---: | :--- | :--- |
| **1. Exploration** | `scene-state-exploration` | `scale(1) translateY(0)` | Natural biome lighting | Trail, landmarks, horizon & compass |
| **2. Threat Detected (Stage 1)** | `scene-state-discovered` | `scale(1.015) translateY(-0.5%)` | Subtle mist vignette (`72px`) | Lurking shadow silhouette in the mist (strict secrecy) |
| **3. Combat Entry (Reveal)** | `scene-state-combat` + `anim-monster-emerge` | `scale(1.038) translateY(-1.2%)` | Combat vignette (`96px`) | Smooth approach from `20 ft` sighting to `12 ft` melee |
| **4. Active Combat (Stage 2)** | `scene-state-combat` | `scale(1.038) translateY(-1.2%)` | Combat vignette (`96px`) | Monster silhouette, anatomical grounding & HUD plate |
| **5. Victory & Return** | `scene-state-victory` | `scale(1.01) translateY(0)` | Warm golden relief (`68px`) | Subdued defeated monster remains, XP/loot & bearing restoration |

---

## 3. Combat Feedback & Readability Matrix

| Combat Event | Actor Animation / FX | Exchange Banner (`#seq-exchange-banner`) | Floating Callout |
| :--- | :--- | :--- | :--- |
| **Combat Entry** | `anim-monster-emerge` (`360–520ms` distance transition) | `⚡ Engaged at melee range — press [Space] or click creature to strike` | `⚔️ Battle Joined!` |
| **Player Attack — Hit** | `.slash-svg.is-striking` + `anim-monster-hit` recoil | `⚔️ You hit (-X HP)` (`exchange-hit`) | `-X HP` (`pop-strike`) |
| **Player Attack — Critical Hit** | `.slash-svg.is-crit-striking` + `anim-monster-crit-hit` | `💥 Critical Hit (CRIT -X HP)` (`exchange-crit`) | `CRIT -X HP` (`pop-crit`) |
| **Player Attack — Miss** | `.slash-svg.is-striking` + `anim-monster-dodge` sidestep | `💨 Your attack missed — enemy evaded!` (`exchange-miss`) | `Miss` (`pop-miss`) |
| **Monster Counterattack — Hit** | `anim-monster-lunge` + `flash-blood` + `shake-damage` | Appends `• 🩸 Enemy dealt Y dmg` (`exchange-damage`) | `-Y HP` (`pop-damage`) |
| **Monster Counterattack — Miss** | `anim-monster-lunge` | Appends `• 🛡️ Evaded counterattack` | `Miss` (`pop-miss`) |
| **Monster Slain / Victory** | `anim-monster-defeat` collapse -> `.is-victory-remains` | `🏆 Foe slain — victory achieved!` (`exchange-crit`) | `🏆 VICTORY!` (`pop-crit`) |

---

## 4. Image Compositing & Artwork Integrity

- **Zero Alteration to Approved Artwork**: All 98 original monster paintings (`public/images/monsters/*.png`) and 37 verified RGBA cutouts (`public/images/monsters-cutout/*.png`) are preserved untouched.
- **Cutout Transparency & Grounding**: `combat.css` applies `--monster-img-shift-x`, `--monster-img-shift-y`, `--monster-img-trim-scale`, and `--monster-offset-y` to grounded Integrated cutouts so transparent bottom padding never causes feet, paws, or coils to float above their contact shadows.
- **Card Fallback Grounding**: The 61 monsters without RGBA cutouts use adaptive aspect-ratio cards anchored to the scene ground plane (`margin-top: auto`) with pedestal shadows and vignette trim compensation (`--monster-img-trim-scale`), eliminating uniform square floating cards.
