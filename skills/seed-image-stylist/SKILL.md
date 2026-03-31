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

## Visual system defaults

| Property    | Ingredients                                 | Recipes / base meals                       |
| ----------- | ------------------------------------------- | ------------------------------------------ |
| Background  | Soft neutral surface, minimal context       | Cozy kitchen setting, uncluttered          |
| Composition | Centered subject, square-friendly           | Plated/tray-style, landscape or square     |
| Light       | Soft natural editorial, clean shadows       | Soft daylight, shallow (not extreme) DoF   |
| Props       | Minimal — bowl, pile, or portion for pantry | Practical plating, not restaurant-fussy    |
| Tone        | Calm, recognizable at thumbnail size        | Appetizing, practical, home-cooking warmth |

All images share: warm color balance, consistent editorial food photography,
no text/logos/labels/watermarks/hands/faces.

For detailed visual rules, composition guidance, and prompt-writing conventions,
see [style-guide.md](style-guide.md).

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
3. **Aspect ratio**: square (1:1) for ingredients; 4:3 or 16:9 for meal heroes;
   propose both if unsure
4. **Background treatment**: neutral surface / soft kitchen context / none
5. **Composition style**: centered / slightly art-directed / overhead / 3/4 angle

### Step 3: Write prompts

Follow these rules (detail in [style-guide.md](style-guide.md)):

- **Subject first**, then composition, then light/background, then style.
- Specific enough to produce good results; not bloated with random adjectives.
- Optimize for small-thumbnail recognizability.
- Disambiguate visually similar items explicitly.
- Add a short negative prompt when useful.

### Step 4: Output the full plan

Structure output as:

1. **Visual system** — shared art direction summary
2. **Item-by-item image plan** — classification, ratio, composition, background
3. **Final prompts** — polished generation prompts with negative guidance
4. **Filenames and mapping** — suggested filename, alt text, target id, `imageUrl` destination
5. **Consistency notes** — how items relate visually across the library
6. **Open ambiguities** — only if genuinely needed (vague items, multiple forms)

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
- Do not default to luxury restaurant plating or generic stock-photo clichés.
- Do not generate prompts with labels, text overlays, watermarks, or branded packaging.
- Do not silently overwrite existing `imageUrl` mappings unless explicitly asked.
- If asked to update seed data, prefer append/update instructions that preserve
  existing ids and references.
- If a seed item is too vague to image confidently, say so and propose 1–2
  canonical interpretations.
- Use the app's real seeded naming wherever possible — do not invent variants.

## Consistency checklist

- [ ] All ingredient images share the same background/light/style family
- [ ] All meal images share the same background/light/style family
- [ ] Ingredient and meal families feel related but distinct
- [ ] Similar items are visually disambiguated (e.g. white rice vs brown rice)
- [ ] Pantry items shown as portions, not retail packaging
- [ ] Sauces/condiments shown in bowls/ramekins, not labeled bottles
- [ ] Rescue meals feel simple and cozy, not fancy
- [ ] Batch-prep components shown in practical containers
