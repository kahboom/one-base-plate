import { describe, it, expect } from 'vitest';
import { applyPaprikaCategoryTagMappings } from '../src/lib/applyPaprikaCategoryTagMappings';
import {
  scorePaprikaCategoryToTag,
  collectPaprikaCategoryRows,
  rankPaprikaCategoryTagMatches,
  householdRecipeTagCandidates,
  normalizeNewRecipeTagFromUser,
} from '../src/lib/paprikaCategoryTagSuggest';
import type { Household, Recipe } from '../src/types';

const minimalHousehold = (recipes: Recipe[]): Household => ({
  id: 'h-f074',
  name: 'F074',
  members: [
    {
      id: 'm1',
      name: 'A',
      role: 'adult',
      safeFoods: [],
      hardNoFoods: [],
      preparationRules: [],
      textureLevel: 'regular',
      allergens: [],
      notes: '',
    },
  ],
  ingredients: [],
  recipes,
  baseMeals: [],
  weeklyPlans: [],
  pinnedMealIds: [],
  mealOutcomes: [],
});

describe('F074: Paprika category → tag fuzzy suggest & apply', () => {
  const candidates = householdRecipeTagCandidates({ recipes: [], baseMeals: [] });

  it('scores close matches highly for multi-word categories and light typos', () => {
    const quick = candidates.find((c) => c.value === 'quick')!;
    expect(scorePaprikaCategoryToTag('Quick Dinners', quick)).toBeGreaterThan(0.55);
    expect(scorePaprikaCategoryToTag('quik dinner', quick)).toBeGreaterThan(0.4);
  });

  it('ranks soup ahead of unrelated tags for "Soups"', () => {
    const ranked = rankPaprikaCategoryTagMatches('Soups', candidates, 5);
    expect(ranked[0]?.candidate.value).toBe('soup');
  });

  it('collectPaprikaCategoryRows dedupes by normalized key and counts recipes', () => {
    const recipes: Recipe[] = [
      {
        id: 'a',
        name: 'A',
        components: [],
        provenance: {
          sourceSystem: 'paprika',
          importTimestamp: 't',
          rawCategories: ['Italian', 'italian'],
        },
      },
      {
        id: 'b',
        name: 'B',
        components: [],
        provenance: { sourceSystem: 'paprika', importTimestamp: 't', rawCategories: ['Italian'] },
      },
    ];
    const rows = collectPaprikaCategoryRows(recipes);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.recipeCount).toBe(2);
  });

  it('normalizeNewRecipeTagFromUser produces slug', () => {
    expect(normalizeNewRecipeTagFromUser('  Taco Night!  ')).toBe('taco-night');
  });

  it('applyPaprikaCategoryTagMappings adds tags for matching raw categories', () => {
    const r1: Recipe = {
      id: 'r1',
      name: 'A',
      components: [],
      tags: ['soup'],
      provenance: {
        sourceSystem: 'paprika',
        importTimestamp: 't',
        rawCategories: ['Italian', 'Soup'],
      },
    };
    const household = minimalHousehold([r1]);
    const out = applyPaprikaCategoryTagMappings(household, new Set(['r1']), {
      italian: 'weeknight',
    });
    const updated = out.recipes!.find((x) => x.id === 'r1')!;
    expect(updated.tags).toContain('weeknight');
    expect(updated.tags).toContain('soup');
  });
});
