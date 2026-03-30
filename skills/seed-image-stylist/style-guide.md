# Seed Image Stylist — Style Guide

Detailed visual rules and prompt-writing conventions for the seed image library.
Referenced from [SKILL.md](SKILL.md).

## Visual style goals

- Warm, modern, clean, appetizing, family-friendly
- Soft natural light, uncluttered
- Realistic enough to be recognizable
- Polished enough to feel premium
- Consistent across the entire library

## Global rules

- Prefer cohesive semi-real editorial food photography over mixed styles.
- Avoid chaotic backgrounds, busy props, hard flash, oversaturation, meme styling.
- Avoid text baked into images.
- Avoid logos, packaging labels, or brand-specific visuals unless explicitly requested.
- Avoid random human hands or faces unless explicitly requested.
- Keep composition simple and readable at small thumbnail sizes.
- Favor strong subject isolation and clear silhouettes.
- Images should feel calm and useful in an app UI.

## Ingredient image rules

- **Single-ingredient focus.** Subject centered or slightly art-directed.
- **Clean neutral background** or very soft kitchen-surface context.
- **Minimal props.** Ingredient immediately identifiable at small size.
- Show raw form unless a better canonical representation exists.
- For ambiguous ingredients, choose the most recognizable household-shopping form.
- **Pantry items** (rice, pasta, flour, beans, spices): tasteful bowl, pile, or
  small portion — never retail packaging.
- **Sauces / condiments**: small bowl, spoon, ramekin, or jar-style presentation
  without labels.

## Recipe / base meal image rules

- Show the prepared dish in realistic plated or tray-style form.
- Reflect how the meal would appear in a household app context: practical,
  appealing, not restaurant-fussy.
- Keep the meal readable and recognizable as one dish.
- **Flexible base meals**: show the shared structure, not one narrow variant.
- **"One base meal, multiple assemblies"**: communicate the main meal identity
  cleanly.
- **Rescue meals**: simple, cozy, doable — not fancy.
- **Batch-prep / component recipes**: show prepared component in a practical
  container or serving format.

## Consistency rules

- Shared art direction across all prompts: similar lighting, lens feel,
  background restraint, color balance.
- Ingredient images should feel like one family.
- Meal images should feel like one family.
- Ingredient and meal families should still feel related to each other.
- **Ingredients**: prefer square-friendly (1:1) compositions.
- **Meals**: prefer landscape (4:3 or 16:9) for hero imagery if the UI benefits.
- When unsure, propose both a square thumbnail and a wider hero version.

## Prompt-writing conventions

### Structure

Write prompts in this order:

1. **Subject** — what the food item is, its form and state
2. **Composition** — framing, angle, placement
3. **Light and background** — lighting quality, surface, environment
4. **Visual style** — overall aesthetic reference

### Quality rules

- Specific enough to produce good results.
- Not bloated with random adjectives.
- Optimize for small-thumbnail recognizability as well as larger views.
- If a subject could be confused with similar items, disambiguate clearly.
- For ingredients with many forms, choose the canonical one matching seed data.

### Negative prompts

Include avoidance guidance when useful:

- No text, labels, watermarks, logos, branded packaging
- No human hands or faces
- No cluttered backgrounds or busy props
- No oversaturation or hard flash
- No restaurant/fine-dining plating (for home-style meals)

## Example prompts

### Ingredient: chicken breast

```
A raw boneless skinless chicken breast, centered on a clean light marble surface.
Soft natural side light, subtle shadow. Minimal editorial food photography,
warm neutral tones, sharp focus on subject.

Negative: no text, no labels, no hands, no packaging, no busy background.
```

### Ingredient: basmati rice

```
A small neat pile of uncooked basmati rice grains on a clean light wood surface,
seen from a slight overhead angle. Soft diffused daylight, warm tones,
editorial food photography style.

Negative: no packaging, no brand labels, no text, no props, no busy background.
```

### Base meal: chicken stir-fry

```
A home-cooked chicken stir-fry with mixed vegetables served in a simple white
bowl on a light wood table, seen from a 3/4 overhead angle. Soft warm daylight,
shallow depth of field, cozy practical home-cooking editorial style. Uncluttered
setting, minimal props.

Negative: no text, no restaurant plating, no garnish towers, no hands, no faces.
```

### Recipe: batch-prep bolognese sauce

```
A large portion of rich meat bolognese sauce in a practical glass storage
container with the lid beside it, seen from a slight overhead angle on a clean
kitchen counter. Soft natural light, warm tones, practical home-cooking
editorial style.

Negative: no text, no labels, no branded containers, no busy background.
```
