---
name: watercolor-food-illustration
description: >-
  Visual style guidelines for generating simple watercolor food and ingredient
  illustrations. In OneBasePlate, batch-generate matching PNGs with
  scripts/generate-seed-image.mjs (node --env-file=.env). Use when generating
  prompts for food imagery, seed images, or any request for clean, hand-drawn
  editorial cookbook-style art.
---

# Watercolor Food Illustration Style

This skill defines the visual style and prompting rules for creating simple, elegant watercolor food illustrations. It should be used whenever generating image prompts for ingredients, meals, or drinks that require a clean, hand-drawn, non-photorealistic look.

## GENERATING SEED IMAGES IN THIS REPO (OneBasePlate)

**Do not assume the shell has `OPENAI_API_KEY` set.** The key lives in `.env`; load it when invoking Node:

```bash
node --env-file=.env scripts/generate-seed-image.mjs
```

**Script:** [`scripts/generate-seed-image.mjs`](../../scripts/generate-seed-image.mjs) — calls the OpenAI Images API (DALL·E 3), writes **`public/images/seed/{id}.png`** (1024×1024). Prompt text is built to match this skill’s watercolor spot-art intent.

**Workflow:**

1. Add or edit entries in the script’s **`ITEMS`** array: `{ id, subject }` and optional **`dish: true`** for plated / prepared foods (softer negative prompt, bowl-focused layout).
2. **`id`** must match the filename stem and seed data: ingredients use `ing-*`, recipes use `rec-*`. Reference in JSON as `imageUrl`: `/images/seed/{id}.png`.
3. Run the full batch, or only specific ids:  
   `node --env-file=.env scripts/generate-seed-image.mjs rec-tray-pizza ing-bacon`
4. If the asset is new, set **`imageUrl`** on the ingredient or recipe in **`fixtures/households/`** (then **`npm run db:seed`** so **`src/seed-data.json`** stays in sync).

Write **`subject`** strings using the composition and fallback rules below (clear food state, minimal props, no labels). The script wraps them in the shared style phrase; you normally **do not** hand-paste the full prompt unless debugging.

## WHEN TO USE / WHEN NOT TO USE

**Use this skill for:**

- Seed images for ingredients, recipes, and base meals
- Menu illustrations and app placeholders
- Discovery/search visuals where a unified, calm aesthetic is needed
- Any request for "cookbook spot art" or "hand-drawn food"

**Do NOT use this skill for:**

- UI mockups, wireframes, or app screenshots
- Photorealistic marketing photography
- Highly stylized vector icons or logos
- Anime or mascot character design

## STYLE INTENT

Create simple watercolor illustrations of food and ingredients with a hand-drawn editorial feel. The result should look lightly painted, clean, elegant, and approachable rather than photorealistic or heavily stylized.

The target look should feel like:

- delicate food sketchbook illustrations
- light editorial cookbook spot art
- watercolor ingredient studies
- simple painted menu illustrations

## PROMPT COMPOSITION RULES

When producing image prompts, structure them logically and bias toward these phrases:

1. **Subject First:** Clearly define the food item and its state (e.g., "A halved avocado showing the pit").
2. **Style Keywords:** "simple watercolor food illustration", "hand-drawn watercolor ingredient study", "delicate food sketch with watercolor wash", "minimal cookbook-style food painting".
3. **Technique Details:** "light pencil outline with soft watercolor fill", "subtle natural color variation", "gentle imperfections".
4. **Composition & Background:** "isolated illustrated food subject on a pure white background", "minimal and clean", "lots of negative space", "simple 3/4 angle".

## NEGATIVE PROMPT GUIDANCE

Always include negative guidance to prevent the model from drifting into default styles. Use phrases like:

- no photorealism, not a photograph
- no vector icon style, no flat design
- no heavy outlines, no thick comic lines
- no heavy cel shading
- no dramatic studio lighting
- no cluttered background, no busy props
- no text, no labels, no borders, no branding
- no overly cute mascot styling (unless explicitly requested)

## FALLBACK RULES FOR DIFFICULT FOODS

If the subject is challenging to illustrate clearly:

- **Visually complex dish (e.g., stew, casserole):** Simplify the plating. Focus on a few recognizable hero ingredients resting on top.
- **Visually plain ingredient (e.g., flour, white rice):** Rely on silhouette and subtle color variation. Show it in a simple, rustic bowl or as a neat, textured mound.
- **Multiple components needed:** Keep them sparse and well separated. Avoid overlapping them into an unreadable pile.
- **Ambiguous food:** Prioritize recognizability over artistic flourish. Exaggerate the defining characteristic slightly (e.g., the texture of bread crust) to ensure it reads correctly at a glance.

## BOUILLON, STOCK CUBES, AND CONCENTRATED BROTH

Recipes often list **bouillon**, **stock cubes**, **broth cubes**, or **instant stock** (granules). Treat these as **small packaged or loose concentrates**, not as a bowl of liquid stock — liquid stock is a different illustration.

**Shared composition (thumbnail-safe):**

- Show **one or two small cubes** (slightly rounded edges, simple foil-wrapped block **without any text or logos**) **or** a **small neat pile of granules** on white — not both unless you need extra clarity.
- Use **subtle color wash** on the cube or granules to signal flavor; keep outlines light so it still reads as watercolor spot art, not a branded product shot.
- **Do not** add typography, nutrition panels, or recognizable commercial packaging.

**Beef bouillon / beef stock cube**

- **Subject cues:** warm **brown to deep reddish-brown** wash; slightly “rich savory” tone without looking like raw meat.
- **Example `subject` strings:** “a single small beef stock bouillon cube with soft brown watercolor wash”, “a few loose beef bouillon granules with subtle reddish-brown tones”, “two small wrapped beef broth cubes, plain foil, no labels”.

**Chicken bouillon / chicken stock cube**

- **Subject cues:** **golden yellow to pale amber** wash; lighter and warmer than beef, not orange like cheese.
- **Example `subject` strings:** “a single small chicken bouillon cube with gentle golden-yellow watercolor”, “a small mound of chicken stock granules with soft amber wash”.

**Vegetable bouillon / vegetable stock cube**

- **Subject cues:** **muted green, olive, or herb-toned** wash; can read slightly “garden” or savory-green — distinct from chicken (yellow) and beef (brown).
- **Example `subject` strings:** “a single small vegetable stock cube with soft green herb-toned watercolor”, “vegetable bouillon granules with subtle olive-green wash”.

**Synonyms to illustrate the same way:** stock cube, bouillon cube, broth cube, instant bouillon, stock pot / concentrate cube (still no brand marks).

**If the recipe line is ambiguous** (“beef stock or broth”): prefer the **cube or granules** treatment when the string clearly means concentrate; use a **simple cup or small bowl of brown liquid** only when the ingredient is explicitly liquid stock or broth.

## QUALITY BAR

**A good output should:**

- instantly read as the intended food
- feel hand-painted, light, and elegant
- avoid visual clutter
- remain legible at thumbnail size
- have restrained color and detail
- feel consistent across many foods in the same app

**A bad output should be flagged if it is:**

- too realistic (looks like a photo with a filter)
- too glossy or 3D
- too cartoonish or kawaii
- too flat/vector-like
- too busy or overcrowded with props
- too dark or saturated
- inconsistent with the delicate watercolor illustration style

## QUALITY CONTROL CHECKLIST

Before finalizing an image or prompt, verify:

- [ ] Is the subject immediately recognizable?
- [ ] Is the background pure white or extremely clean?
- [ ] Does it look hand-painted with soft washes and light outlines?
- [ ] Is it free of text, labels, and watermarks?
- [ ] Will it read clearly when scaled down to a small thumbnail?
- [ ] Does it avoid looking like a photograph or a flat vector icon?

## EXAMPLES

### Example 1: A single ingredient (Avocado)

**Prompt:**
A simple watercolor food illustration of a halved avocado showing the pit. Hand-drawn watercolor ingredient study, light pencil outline with soft green and brown watercolor wash. Isolated illustrated food subject on a pure white background. Minimal cookbook-style spot art, delicate and clean, lots of negative space.
**Negative:** no photorealism, no vector icon style, no heavy outlines, no cluttered background, no text, no props.

### Example 2: A plated savory dish (Chicken Stir-fry)

**Prompt:**
A delicate food sketch with watercolor wash of a chicken stir-fry with mixed vegetables served in a simple white bowl. Simple watercolor food illustration, light editorial cookbook spot art. Hand-drawn feel, gentle imperfections, soft natural color variation. Isolated on a plain white background, 3/4 angle.
**Negative:** no photorealism, no dramatic lighting, no heavy cel shading, no text, no cluttered background, no restaurant plating.

### Example 3: A dessert (Blueberry Muffin)

**Prompt:**
A minimal cookbook-style food painting of a single blueberry muffin. Simple watercolor food illustration with light pencil structure and soft watercolor fills. Delicate and elegant, hand-made feel. Isolated on a clean white background.
**Negative:** no photorealism, no thick comic outlines, no vector icon style, no text, no borders, no branding.

### Example 4: A drink (Cup of Coffee)

**Prompt:**
A simple painted menu illustration of a ceramic mug filled with black coffee. Hand-drawn watercolor study, light sketch marks with subtle watercolor wash. Clean, minimal composition, isolated on white background.
**Negative:** no photorealism, no 3D render, no flat vector art, no text, no cluttered background.

### Example 5: A small grouped set of ingredients (Garlic and Basil)

**Prompt:**
A delicate watercolor food illustration of a garlic bulb next to a few fresh basil leaves. Light editorial cookbook spot art, soft watercolor washes with understated outlines. Minimal and clean, isolated on a plain white background, top-down angle.
**Negative:** no photorealism, no heavy outlines, no vector icon style, no text, no busy background.

### Example 6: Concentrated stock (Beef bouillon / stock cube)

**Prompt:**
A simple watercolor food illustration of a single small beef stock bouillon cube with a soft brown and reddish-brown watercolor wash, plain wrapped block with no text or branding. Hand-drawn ingredient study, light pencil outline, isolated on a pure white background, lots of negative space.
**Negative:** no photorealism, no vector icon style, no labels or logos, no bowl of liquid soup, no cluttered background.
