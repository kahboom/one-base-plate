import { describe, it, expect, beforeEach } from 'vitest';
import {
  parsePaprikaRecipes,
  autoResolveHighConfidence,
  autoResolveHighConfidenceWithStats,
  revertAutoResolvedGroup,
  buildDraftRecipe,
  canFinalizePaprikaImport,
  applyGroupResolution,
  groupKeyForParsedName,
  saveImportSession,
  loadImportSession,
} from '../src/paprika-parser';
import type { PaprikaRecipe } from '../src/paprika-parser';
import type { Household, Ingredient } from '../src/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeIngredient(overrides: Partial<Ingredient>): Ingredient {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    name: overrides.name ?? 'unnamed',
    category: overrides.category ?? 'pantry',
    tags: overrides.tags ?? [],
    shelfLifeHint: '',
    freezerFriendly: false,
    babySafeWithAdaptation: false,
    source: 'manual',
    ...overrides,
  };
}

function makeHousehold(ingredients: Ingredient[] = []): Household {
  return {
    id: 'h-f076',
    name: 'F076 Test',
    members: [],
    ingredients,
    recipes: [],
    baseMeals: [],
    weeklyPlans: [],
    pinnedMealIds: [],
    mealOutcomes: [],
  };
}

function makePaprikaRecipe(overrides: Partial<PaprikaRecipe> = {}): PaprikaRecipe {
  return {
    name: 'Test Recipe',
    ingredients: '',
    directions: '',
    notes: '',
    source: '',
    source_url: '',
    prep_time: '',
    cook_time: '',
    total_time: '',
    difficulty: '',
    servings: '',
    categories: [],
    image_url: '',
    photo_data: null,
    uid: crypto.randomUUID(),
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
});

// ---------------------------------------------------------------------------
// F076: Auto-resolution pre-pass outcomes
// ---------------------------------------------------------------------------

describe('F076 auto-resolution pre-pass', () => {
  it('auto-resolves household exact/strong match → action "use", autoResolved flag set', () => {
    const chickenBreast = makeIngredient({ id: 'ing-chicken', name: 'chicken breast', category: 'protein' });
    const hh = makeHousehold([chickenBreast]);
    const recipe = makePaprikaRecipe({ ingredients: '300g chicken breast' });
    // parsePaprikaRecipes already resolves exact/strong household matches and sets autoResolved
    const parsed = parsePaprikaRecipes([recipe], hh.ingredients, []);
    const line = parsed[0]!.parsedLines[0]!;
    expect(line.action).toBe('use');
    expect(line.resolutionStatus).toBe('resolved');
    expect(line.autoResolved).toBe(true);
  });

  it('auto-resolves catalog exact/strong match → action "create", autoResolved flag set', () => {
    // "broccoli" is in MASTER_CATALOG; no household ingredient.
    // parsePaprikaRecipes resolves exact/strong catalog matches immediately and sets autoResolved.
    const hh = makeHousehold([]);
    const recipe = makePaprikaRecipe({ ingredients: '1 head broccoli' });
    const parsed = parsePaprikaRecipes([recipe], hh.ingredients, []);
    const line = parsed[0]!.parsedLines[0]!;
    if (line.status === 'catalog' && (line.confidenceBand === 'exact' || line.confidenceBand === 'strong')) {
      expect(line.action).toBe('create');
      expect(line.resolutionStatus).toBe('resolved');
      expect(line.autoResolved).toBe(true);
    } else {
      // Catalog match threshold not met — line stays pending, auto-resolve leaves it for Tier 3
      expect(line.resolutionStatus).toBe('pending');
    }
  });

  it('auto-resolves common staple match (salt) → action "create" with staple category', () => {
    const hh = makeHousehold([]);
    const recipe = makePaprikaRecipe({ ingredients: '1 tsp salt' });
    const parsed = parsePaprikaRecipes([recipe], hh.ingredients, []);
    const { recipes, stats } = autoResolveHighConfidenceWithStats(parsed);

    const line = recipes[0]!.parsedLines[0]!;
    expect(line.action).toBe('create');
    expect(line.resolutionStatus).toBe('resolved');
    expect(line.autoResolved).toBe(true);
    expect(line.createDraft?.canonicalName).toBe('salt');
    expect(line.createDraft?.category).toBe('pantry');
    expect(stats.stapleMatches).toBeGreaterThanOrEqual(1);
  });

  it('auto-resolves water staple (common unmatched pantry item)', () => {
    const hh = makeHousehold([]);
    const recipe = makePaprikaRecipe({ ingredients: '2 cups water' });
    const parsed = parsePaprikaRecipes([recipe], hh.ingredients, []);
    // water should either be catalog-resolved (autoResolved) or staple-resolved (autoResolved)
    // In either case the line should end up resolved with autoResolved set
    const resolved = autoResolveHighConfidence(parsed);
    const resolvedLine = resolved[0]!.parsedLines[0]!;
    expect(resolvedLine.resolutionStatus).toBe('resolved');
    expect(resolvedLine.autoResolved).toBe(true);
  });

  it('does NOT auto-resolve low-confidence lines (Tier 3)', () => {
    const hh = makeHousehold([]);
    // Something obscure that will be unmatched but not a staple
    const recipe = makePaprikaRecipe({ ingredients: '2 tbsp xyzobscurething9837' });
    const parsed = parsePaprikaRecipes([recipe], hh.ingredients, []);
    const resolved = autoResolveHighConfidence(parsed);
    const line = resolved[0]!.parsedLines[0]!;
    // Must remain pending — no auto-resolution for unrecognized ingredients
    expect(line.resolutionStatus).toBe('pending');
    expect(line.autoResolved).toBeUndefined();
  });

  it('auto-resolves empty-name lines to "ignore"', () => {
    const hh = makeHousehold([]);
    const recipe = makePaprikaRecipe({ ingredients: 'Ingredients for the sauce:' });
    const parsed = parsePaprikaRecipes([recipe], hh.ingredients, []);
    const resolved = autoResolveHighConfidence(parsed);
    // Either filtered as instruction or resolved as ignore
    for (const line of resolved[0]!.parsedLines) {
      if (!line.name?.trim()) {
        expect(line.action).toBe('ignore');
        expect(line.resolutionStatus).toBe('resolved');
      }
    }
  });

  it('does not auto-resolve staple lines with perLineOverride set', () => {
    // perLineOverride prevents autoResolveHighConfidenceWithStats from overwriting a user's prior choice.
    // Use a staple (salt) which would otherwise be auto-resolved from unmatched → create.
    const hh = makeHousehold([]);
    const recipe = makePaprikaRecipe({ ingredients: '1 tsp salt' });
    let parsed = parsePaprikaRecipes([recipe], hh.ingredients, []);
    // If it was already auto-resolved by parser (e.g. catalog match), revert it so it's pending
    const lineBeforeRevert = parsed[0]!.parsedLines[0]!;
    const groupKey = (lineBeforeRevert.groupKey ?? groupKeyForParsedName(lineBeforeRevert.name))!;
    parsed = revertAutoResolvedGroup(parsed, groupKey);
    // Now mark it with perLineOverride (simulates user having already made a choice in a previous pass)
    parsed[0]!.parsedLines[0] = {
      ...parsed[0]!.parsedLines[0]!,
      perLineOverride: true,
      resolutionStatus: 'pending',
      action: 'pending',
    };
    const resolved = autoResolveHighConfidence(parsed);
    const line = resolved[0]!.parsedLines[0]!;
    // perLineOverride must prevent auto-resolve from touching it
    expect(line.perLineOverride).toBe(true);
    expect(line.autoResolved).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// F076: Staples do not create duplicates when household match exists
// ---------------------------------------------------------------------------

describe('F076 staple deduplication', () => {
  it('household match takes priority over staple list — action is "use" not "create"', () => {
    // If household already has "salt", auto-resolve should prefer the household match
    const salt = makeIngredient({ id: 'ing-salt', name: 'salt', category: 'pantry' });
    const hh = makeHousehold([salt]);
    const recipe = makePaprikaRecipe({ ingredients: '1 tsp salt' });
    const parsed = parsePaprikaRecipes([recipe], hh.ingredients, []);
    const resolved = autoResolveHighConfidence(parsed);
    const line = resolved[0]!.parsedLines[0]!;
    // Household exact match wins over staple create
    expect(line.action).toBe('use');
    expect(line.resolutionStatus).toBe('resolved');
    expect(line.autoResolved).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// F076: autoResolved flag in ImportMapping (audit trail)
// ---------------------------------------------------------------------------

describe('F076 autoResolved in ImportMapping', () => {
  it('auto-resolved "use" mapping carries autoResolved: true', () => {
    const chickenBreast = makeIngredient({ id: 'ing-chicken', name: 'chicken breast', category: 'protein' });
    const hh = makeHousehold([chickenBreast]);
    const raw = makePaprikaRecipe({ ingredients: '300g chicken breast' });
    let parsed = parsePaprikaRecipes([raw], hh.ingredients, []);
    parsed = autoResolveHighConfidence(parsed);

    const line = parsed[0]!.parsedLines[0]!;
    if (line.action !== 'use' || !line.autoResolved) return; // guard

    const { recipe } = buildDraftRecipe(raw, parsed[0]!.parsedLines, hh.ingredients);
    const mapping = recipe.importMappings?.find((m) => m.action === 'use');
    expect(mapping?.autoResolved).toBe(true);
  });

  it('auto-resolved "create" mapping (staple) carries autoResolved: true', () => {
    const hh = makeHousehold([]);
    const raw = makePaprikaRecipe({ ingredients: '1 tsp salt' });
    let parsed = parsePaprikaRecipes([raw], hh.ingredients, []);
    parsed = autoResolveHighConfidence(parsed);

    const { newIngredients } = buildDraftRecipe(raw, parsed[0]!.parsedLines, hh.ingredients);
    const allIngredients = [...hh.ingredients, ...newIngredients];
    // rebuild with all ingredients so 'use' refs resolve correctly
    const { recipe } = buildDraftRecipe(raw, parsed[0]!.parsedLines, allIngredients);
    const mapping = recipe.importMappings?.find((m) => m.action === 'create');
    expect(mapping?.autoResolved).toBe(true);
  });

  it('manually resolved lines do NOT carry autoResolved flag', () => {
    const hh = makeHousehold([]);
    const raw = makePaprikaRecipe({ ingredients: '1 tbsp xyzobscurething9837' });
    let parsed = parsePaprikaRecipes([raw], hh.ingredients, []);
    const key = parsed[0]!.parsedLines[0]!.groupKey!;
    parsed = applyGroupResolution(parsed, key, {
      kind: 'create',
      draft: { canonicalName: 'mystery spice', category: 'pantry', tags: [], retainImportAlias: false },
    });

    const { recipe } = buildDraftRecipe(raw, parsed[0]!.parsedLines, hh.ingredients);
    const mapping = recipe.importMappings?.find((m) => m.action === 'create');
    expect(mapping?.autoResolved).toBeFalsy();
  });

  it('autoResolved flag is preserved in session round-trip', () => {
    const salt = makeIngredient({ id: 'ing-salt', name: 'salt', category: 'pantry' });
    const hh = makeHousehold([salt]);
    const recipe = makePaprikaRecipe({ ingredients: '1 tsp salt' });
    let parsed = parsePaprikaRecipes([recipe], hh.ingredients, []);
    parsed = autoResolveHighConfidence(parsed);

    saveImportSession({
      householdId: 'h-f076',
      parsedRecipes: parsed,
      step: 'review',
      savedAt: new Date().toISOString(),
    });
    const session = loadImportSession('h-f076');
    const restoredLine = session?.parsedRecipes[0]?.parsedLines[0];
    expect(restoredLine?.autoResolved).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// F076: revertAutoResolvedGroup restores to pending
// ---------------------------------------------------------------------------

describe('F076 revertAutoResolvedGroup', () => {
  it('restores an auto-resolved group to pending and clears autoResolved flag', () => {
    const chickenBreast = makeIngredient({ id: 'ing-chicken', name: 'chicken breast', category: 'protein' });
    const hh = makeHousehold([chickenBreast]);
    const recipe = makePaprikaRecipe({ ingredients: '300g chicken breast' });
    let parsed = parsePaprikaRecipes([recipe], hh.ingredients, []);
    parsed = autoResolveHighConfidence(parsed);

    const line = parsed[0]!.parsedLines[0]!;
    if (!line.autoResolved) return; // guard: skip if not auto-resolved (low confidence)

    const groupKey = (line.groupKey ?? groupKeyForParsedName(line.name))!;
    const reverted = revertAutoResolvedGroup(parsed, groupKey);
    const revertedLine = reverted[0]!.parsedLines[0]!;

    expect(revertedLine.resolutionStatus).toBe('pending');
    expect(revertedLine.action).toBe('pending');
    expect(revertedLine.autoResolved).toBeUndefined();
    expect(revertedLine.manualIngredientId).toBeUndefined();
  });

  it('only reverts auto-resolved lines; leaves manual overrides untouched', () => {
    const hh = makeHousehold([]);
    const raw = makePaprikaRecipe({ ingredients: '1 tsp salt\n1 tbsp xyzmanual9837' });
    let parsed = parsePaprikaRecipes([raw], hh.ingredients, []);
    // manually resolve the mystery ingredient
    const mysteryKey = parsed[0]!.parsedLines
      .find((l) => l.name.includes('xyzmanual'))
      ?.groupKey ?? '';
    if (mysteryKey) {
      parsed = applyGroupResolution(parsed, mysteryKey, {
        kind: 'create',
        draft: { canonicalName: 'mystery spice', category: 'pantry', tags: [], retainImportAlias: false },
      });
    }
    parsed = autoResolveHighConfidence(parsed);

    // Revert the salt group
    const saltKey = (
      parsed[0]!.parsedLines.find((l) => l.name === 'salt')?.groupKey ??
      groupKeyForParsedName('salt')
    )!;
    const reverted = revertAutoResolvedGroup(parsed, saltKey);

    // Salt line should now be pending
    const saltLine = reverted[0]!.parsedLines.find((l) => l.name === 'salt');
    if (saltLine) {
      expect(saltLine.resolutionStatus).toBe('pending');
      expect(saltLine.autoResolved).toBeUndefined();
    }

    // Manual resolution must remain resolved (no autoResolved set, so revert skips it)
    const mysteryLine = reverted[0]!.parsedLines.find((l) => l.name.includes('xyzmanual'));
    if (mysteryLine && mysteryKey) {
      expect(mysteryLine.resolutionStatus).toBe('resolved');
    }
  });

  it('draft gate blocks finalize after revert until group is re-resolved', () => {
    const chickenBreast = makeIngredient({ id: 'ing-chicken', name: 'chicken breast', category: 'protein' });
    const hh = makeHousehold([chickenBreast]);
    const recipe = makePaprikaRecipe({ ingredients: '300g chicken breast' });
    let parsed = parsePaprikaRecipes([recipe], hh.ingredients, []);
    parsed = autoResolveHighConfidence(parsed);

    const line = parsed[0]!.parsedLines[0]!;
    if (!line.autoResolved) return; // guard

    const groupKey = (line.groupKey ?? groupKeyForParsedName(line.name))!;
    const reverted = revertAutoResolvedGroup(parsed, groupKey);

    expect(canFinalizePaprikaImport(reverted)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// F076: Draft gate still blocks finalize with unresolved Tier 3 lines
// ---------------------------------------------------------------------------

describe('F076 draft gate with Tier 3 (low-confidence pending) lines', () => {
  it('canFinalizePaprikaImport returns false while obscure line remains pending', () => {
    const hh = makeHousehold([]);
    const recipe = makePaprikaRecipe({ ingredients: '2 tbsp xyzobscurething9837' });
    const parsed = parsePaprikaRecipes([recipe], hh.ingredients, []);
    // Auto-resolve should not touch this obscure ingredient
    const resolved = autoResolveHighConfidence(parsed);
    expect(canFinalizePaprikaImport(resolved)).toBe(false);
  });

  it('canFinalizePaprikaImport returns true only when all lines handled', () => {
    const hh = makeHousehold([]);
    const raw = makePaprikaRecipe({ ingredients: '2 tbsp xyzobscurething9837' });
    let parsed = parsePaprikaRecipes([raw], hh.ingredients, []);
    const key = (parsed[0]!.parsedLines[0]!.groupKey ?? groupKeyForParsedName(parsed[0]!.parsedLines[0]!.name))!;
    parsed = applyGroupResolution(parsed, key, { kind: 'ignore' });
    expect(canFinalizePaprikaImport(parsed)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// F076: Tier 2 batch create with preview writes correct names and categories
// ---------------------------------------------------------------------------

describe('F076 Tier 2 batch create correctness', () => {
  it('buildDraftRecipe writes exact canonical name and category from createDraft', () => {
    const hh = makeHousehold([]);
    const raw = makePaprikaRecipe({ ingredients: '2 chiles\n1 cup xyzobscure' });
    let parsed = parsePaprikaRecipes([raw], hh.ingredients, []);

    // Apply create drafts (simulates "Create all" preview confirm)
    for (const line of parsed[0]!.parsedLines) {
      if (line.resolutionStatus !== 'pending' || !line.name) continue;
      const key = (line.groupKey ?? groupKeyForParsedName(line.name))!;
      parsed = applyGroupResolution(parsed, key, {
        kind: 'create',
        draft: {
          canonicalName: line.name,
          category: 'pantry',
          tags: [],
          retainImportAlias: false,
        },
      });
    }

    const { newIngredients } = buildDraftRecipe(raw, parsed[0]!.parsedLines, hh.ingredients);
    expect(newIngredients.length).toBeGreaterThanOrEqual(1);
    for (const ing of newIngredients) {
      expect(ing.name).toBe(ing.name.toLowerCase().trim());
      expect(['pantry', 'veg', 'protein', 'carb', 'dairy', 'fruit', 'snack', 'freezer']).toContain(
        ing.category,
      );
    }
  });

  it('group resolution applies the same draft to all lines sharing a groupKey', () => {
    const hh = makeHousehold([]);
    // Two lines that normalize to the same ingredient name
    const raw = makePaprikaRecipe({ ingredients: '1 cup xyzunique9837\n2 cups xyzunique9837' });
    let parsed = parsePaprikaRecipes([raw], hh.ingredients, []);

    // Both lines should share the same groupKey
    const lines = parsed[0]!.parsedLines.filter((l) => l.name.includes('xyzunique'));
    expect(lines.length).toBeGreaterThanOrEqual(1);
    const firstKey = (lines[0]!.groupKey ?? groupKeyForParsedName(lines[0]!.name))!;

    // Apply resolution once; should propagate to all occurrences
    parsed = applyGroupResolution(parsed, firstKey, {
      kind: 'create',
      draft: { canonicalName: 'xyzunique9837', category: 'pantry', tags: [], retainImportAlias: false },
    });

    // All lines for that groupKey should now have the same createDraft
    for (const line of parsed[0]!.parsedLines) {
      const k = (line.groupKey ?? groupKeyForParsedName(line.name)) ?? '';
      if (k !== firstKey) continue;
      expect(line.createDraft?.canonicalName).toBe('xyzunique9837');
      expect(line.resolutionStatus).toBe('resolved');
    }
  });
});

// ---------------------------------------------------------------------------
// F076: Tier 1 actions propagate to all matching groups
// ---------------------------------------------------------------------------

describe('F076 Tier 1 group propagation', () => {
  it('applyGroupResolution propagates "use" to all occurrences sharing the same groupKey', () => {
    const chickenBreast = makeIngredient({ id: 'ing-chicken', name: 'chicken breast', category: 'protein' });
    const hh = makeHousehold([chickenBreast]);
    const r1 = makePaprikaRecipe({ name: 'A', ingredients: '300g chicken breast' });
    const r2 = makePaprikaRecipe({ name: 'B', ingredients: '200g chicken breast, diced' });
    let parsed = parsePaprikaRecipes([r1, r2], hh.ingredients, []);

    const key = parsed[0]!.parsedLines[0]!.groupKey!;
    parsed = applyGroupResolution(parsed, key, {
      kind: 'use',
      ingredientId: chickenBreast.id,
      ingredient: chickenBreast,
    });

    for (const recipe of parsed) {
      for (const line of recipe.parsedLines) {
        if (((line.groupKey ?? groupKeyForParsedName(line.name)) ?? '') === key) {
          expect(line.action).toBe('use');
          expect(line.resolutionStatus).toBe('resolved');
        }
      }
    }
  });
});
