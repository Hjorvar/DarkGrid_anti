---
name: language-policy
description: Permanent rule establishing English as the sole player-facing language in Darkgrid.
---

# Darkgrid — Player-Facing Language Policy (English Only)

This document establishes the permanent rule regarding player-facing language for **Darkgrid**.

> [!IMPORTANT]
> **ENGLISH IS THE ONLY PLAYER-FACING LANGUAGE IN DARKGRID.**
>
> All text, interfaces, lore, monster descriptions, encounter text, system feedback, and game content that a player encounters must be exclusively in English.
> This rule is mandatory and applies to all current and future development.

---

## 1. Scope and Core Rules

1. **Player-Facing Language:**
   - English is the only player-facing language in Darkgrid.
   - All text visible in the client browser, HTML templates, rendered views, and UI dialogs must be natural, polished English.

2. **User Interface (UI):**
   - All headings, subheadings, labels, instructions, badges, coordinates, and navigation elements must be in English.
   - All buttons, interactive controls, inputs, placeholders, menus, navigation compasses, and tooltips (`title` attributes) must be in English.
   - All client-side popups, notifications, and alert dialogs must be in English.

3. **Narrative and World Content:**
   - All monster names and descriptions (including all 9 progression and health stage descriptions) must be in English.
   - All world map tile names, region names, terrain labels, and environmental descriptions must be in English.
   - All encounter texts, discovery teasers, combat logs, action results, and investigation outcomes must be in English.

4. **System Messages & Feedback:**
   - All validation errors, HTTP error pages (404, 500, etc.), flash messages, and operational alerts shown to players must be in English.

5. **Newly Generated Content:**
   - Any new monster, item, quest, map region, biome, encounter event, or combat message created in the future must be written in English from inception.

---

## 2. Tone and Style Guidelines

- **Dark Fantasy RPG Atmosphere:**
  The English prose must preserve the grim, atmospheric, gritty tone inspired by Pathfinder 1e and grimdark fantasy literature (e.g. evocative vocabulary, gothic undertones, vivid sensory details).
- **Encounter Secrecy and Suspense:**
  Pre-reveal monster descriptions (`1_distant`, `2_ranger_distant`) must evoke dread, suspicion, and uncertainty without spoiling the monster identity or name.

---

## 3. Permitted Exceptions & Clarifications

1. **Agent and Developer Communication:**
   - Internal agent conversations, prompts, planning documents, code reviews, and developer discussions may be conducted in Icelandic when requested by the developer/user.
2. **Codebase Identifiers and Technical Keys:**
   - Internal code identifiers, database columns, enum constants (e.g. `'NORTH'`, `'DISCOVERED'`, `'FIGHTER'`), terrain codes (`'F'`, `'S'`), and technical data structures must not be renamed unnecessarily just to conform to language policy unless they are directly displayed to players.
