---
name: seed-image-stylist
description: >-
  Generate visually consistent image plans and prompts for seeded ingredients,
  recipes, and base meals. Use when creating placeholder images, writing image
  prompts for seed content, planning imageUrl assets, or styling the seed
  ingredient/recipe/meal library visually.
---

# Seed Image Stylist

Generate high-quality, visually consistent placeholder-image plans and prompts
for OneBasePlate's seeded ingredients, recipes, and base meals.

This is not a generic prompt generator — it enforces a coherent art direction
across the entire seed library so the app feels polished, warm, and intentionally
designed.

## Before you start

1. Read the relevant current files:
   - `PRD.json` — product context, feature flags
   - `agent-progress.md` — recent work
   - `fixtures/households/*.json` — current seed ingredients, recipes, base meals
   - `src/catalog.ts` — master catalog (separate from household seeds)
   - `src/types.ts` — `Ingredient`, `Recipe`, `BaseMeal` all have optional `imageUrl`
2. Identify which items need images (missing `imageUrl` or explicit request).
3. Classify each item: **ingredient** / **recipe** / **base meal**.

## Visual system

**IMPORTANT:** We use a simple watercolor illustration style for all seed images.
You MUST read and apply the `watercolor-food-illustration` skill for all visual
styling, prompt generation rules, and examples.

Do not use photorealistic, 3D, or editorial photography styles.

## Workflow

### Step 1: Audit seed items

Scan the fixture data for items that need images. Group them:

```
- Ingredients without imageUrl
- Recipes without imageUrl
- Base meals without imageUrl
```

### Step 2: Classify and plan each item

For each item, determine:

1. **Image category**: ingredient / recipe / base meal
2. **Subject interpretation**: What canonical visual form? (e.g. raw vs cooked,
   bowl vs pile, plated vs container)
3. **Aspect ratio**: square (1:1) is preferred for the watercolor spot art style.
4. **Composition style**: centered, isolated, minimal props (following the watercolor skill).

### Step 3: Write prompts

Follow the prompting rules and examples in the `watercolor-food-illustration` skill.

- **Subject first**, then the watercolor style phrases, then background/composition.
- Include the negative guidance specified in the skill.
- Disambiguate visually similar items explicitly.

### Step 4: Output the full plan

Structure output as:

1. **Visual system** — brief note that we are using the watercolor illustration style
2. **Item-by-item image plan** — classification, ratio, composition
3. **Final prompts** — polished generation prompts with negative guidance
4. **Filenames and mapping** — suggested filename, alt text, target id, `imageUrl` destination
5. **Open ambiguities** — only if genuinely needed (vague items, multiple forms)

### Mapping target format

For each image, provide:

```
- Item: [name from seed data]
- ID: [ingredient id / recipe id / meal id]
- Field: imageUrl
- Filename: [suggested filename, e.g. ing-chicken-breast.jpg]
- Alt text: [short accessible description]
```

## Guardrails

- Do not output random or inconsistent art directions.
- Do not default to photorealism, luxury restaurant plating, or generic stock-photo clichés.
- Do not generate prompts with labels, text overlays, watermarks, or branded packaging.
- Do not silently overwrite existing `imageUrl` mappings unless explicitly asked.
- If asked to update seed data, prefer append/update instructions that preserve
  existing ids and references.
- Use the app's real seeded naming wherever possible — do not invent variants.
