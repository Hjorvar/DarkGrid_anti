---
trigger: model_decision
description: "Apply whenever creating, editing or managing monster artwork for Darkgrid."
---

# Darkgrid — Monster Art Generation Rules

## 1. Image generation

- Use Google's Nano Banana image generation when available.
- Do not substitute random online images or unrelated image generators without approval.
- Never claim an image has been generated unless the file exists.
- If image generation is unavailable, explain the limitation.

## 2. Consistent visual identity

All monsters must look as though they belong to the same game and were illustrated by the same artist.

Default artistic direction:
- Dark fantasy RPG bestiary illustration.
- Hand-painted 2D digital art.
- Atmospheric, mysterious, slightly ominous.
- Muted colors with carefully chosen highlights.
- Consistent lighting, shadows, detail and texture.
- Clear silhouettes and recognizable monster anatomy.
- Full creature visible and centered.
- Consistent camera angle and framing.
- No text, letters, borders, logos or watermarks.

Avoid:
- Photorealism.
- Cartoon or anime styles.
- Unrequested pixel art.
- Inconsistent illustration techniques.
- Overly bright or playful aesthetics.

## 3. Style reference system

Maintain a master style guide at:

`docs/monster-art-style.md`

Store approved visual references in:

`images/monsters/_references/`

Before generating any monster:
1. Read the master style guide.
2. Examine available approved reference images.
3. Reuse the same visual style instructions.
4. Use reference images with Nano Banana when supported.
5. Change the monster's appearance, not the established art style.

Never independently change the game's visual direction.

## 4. Monster research and visual data grounding

The agent must thoroughly research each monster's visual appearance before generating an image.

### Pre-generation workflow
Before generating a new monster illustration:
1. **Examine monster data in SQLite:** Check `monsters` table (`name`, `habitat`, `descriptions`, `movement_type`, `special_abilities`).
2. **Search for corresponding monster on Archives of Nethys:** Preferably Pathfinder 1e at [https://aonprd.com/](https://aonprd.com/).
3. **Find core anatomical description:** Body structure, size, colors, skin/hide/bark/scales, limbs, maw/head, eyes, and key distinguishing visual features.
4. **Verify creature correspondence:** Confirm that the source describes the correct monster matching Darkgrid's concept and role.
5. **Write an independent visual description:** Formulate an original description in English summarizing physical features and anatomy.
6. **Apply description to approved Darkgrid style in Nano Banana:** Embed the description into the prompt template from `docs/monster-art-style.md` and invoke `generate_image`.
7. **Use approved reference images:** Check against `images/monsters/_references/` to ensure visual style, lighting, and palette consistency.

### Sources and licensing
- Record the source URL and independent visual description for each monster.
- Do not copy Pathfinder illustrations, long raw excerpts, or proprietary licensed text without permission.
- If a monster is not found on Pathfinder/Archives of Nethys, use existing Darkgrid database descriptions and explicitly note that no Pathfinder source was found.
- Do not invent physical characteristics that contradict established monster descriptions in the database.
- Every monster should have a distinctive appearance while remaining part of the same visual collection.

## 5. Image specifications

- Format: PNG.
- Canvas: square, preferably 1024 × 1024.
- Consistent composition and subject scale.
- Leave appropriate margins to avoid clipping.
- Prefer a transparent background when practical; otherwise use the approved consistent background style.
- Images must remain recognizable when displayed at smaller sizes.

Save images under:

`images/monsters/`

Example:

`images/monsters/assassin_vine.png`

Use lowercase filenames with underscores.

## 6. Database integration

- Store image paths in the SQLite database.
- Do not store image binaries in SQLite.
- Each monster should reference its corresponding illustration.
- Never change monster statistics or gameplay rules when generating artwork.
- Do not overwrite existing approved images without permission.

## 7. Quality control

After generating an image, verify:
- The correct monster is depicted.
- The image matches the approved art style.
- The creature is clearly visible.
- The composition is consistent.
- No unwanted text or visual artifacts appear.
- The file was saved correctly.

Regenerate only when necessary.

## 8. Approval process

### Initial style validation (COMPLETED & APPROVED)
1. Selected three visually different monsters: Assassin Vine (plant), Grave Troll (humanoid), Feral Wolf (beast).
2. Generated illustrations, validated visual consistency, and received approval.
3. Master style guide established at `docs/monster-art-style.md`.
4. Approved reference images stored in `images/monsters/_references/`.
5. Official agent rule established at `.agents/rules/monster-art.md`.

### Subsequent generation rules
1. Strictly follow the master style guide in `docs/monster-art-style.md`.
2. Reference the approved images in `images/monsters/_references/`.
3. Generate exactly one main illustration per monster.
4. Create smaller versions by resizing the approved image when needed, without additional AI generation.
5. Preserve the same visual style across the entire monster collection.
6. Do not create alternative poses, animations or variants unless specifically requested.

## 9. Resource management

- Avoid unnecessary image generations.
- Reuse existing approved images.
- Work in small batches.
- Do not start expensive bulk generation without authorization.
- Record generation settings and prompts where practical.

**Primary objective:** Build a visually consistent Darkgrid monster collection, not a collection of unrelated AI-generated illustrations.