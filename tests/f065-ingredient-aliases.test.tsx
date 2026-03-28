import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import type { Household, Ingredient } from '../src/types';
import {
  saveHousehold,
  loadHousehold,
  normalizeIngredientAliasList,
  normalizeIngredientForStorage,
  validateIngredientAliases,
  ingredientMatchesQuery,
  mergeDuplicateMetadata,
  sanitizeIngredientAliasesAgainstHousehold,
} from '../src/storage';
import { matchIngredient, parseRecipeText } from '../src/recipe-parser';
import { parsePaprikaLineFromRaw } from '../src/paprika-parser';
import IngredientManager from '../src/pages/IngredientManager';

function baseIngredient(overrides: Partial<Ingredient> = {}): Ingredient {
  return {
    id: crypto.randomUUID(),
    name: 'test',
    category: 'pantry',
    tags: [],
    shelfLifeHint: '',
    freezerFriendly: false,
    babySafeWithAdaptation: false,
    source: 'manual',
    ...overrides,
  };
}

describe('F065: normalizeIngredientAliasList', () => {
  it('lowercases, trims, collapses spaces, strips trailing punctuation', () => {
    expect(normalizeIngredientAliasList('eggplant', ['  Aubergine  '])).toEqual(['aubergine']);
    expect(normalizeIngredientAliasList('eggplant', ['Aubergine!!'])).toEqual(['aubergine']);
  });

  it('dedupes and removes aliases equal to canonical name', () => {
    expect(
      normalizeIngredientAliasList('coriander', ['cilantro', 'Cilantro', 'coriander']),
    ).toEqual(['cilantro']);
  });

  it('returns undefined when nothing remains', () => {
    expect(normalizeIngredientAliasList('x', [])).toBeUndefined();
    expect(normalizeIngredientAliasList('x', ['  ', 'x'])).toBeUndefined();
  });
});

describe('F065: normalizeIngredientForStorage', () => {
  it('normalizes name and aliases together', () => {
    const ing = baseIngredient({ name: '  Eggplant ', aliases: ['Aubergine!!'] });
    const out = normalizeIngredientForStorage(ing);
    expect(out.name).toBe('eggplant');
    expect(out.aliases).toEqual(['aubergine']);
  });
});

describe('F065: validateIngredientAliases', () => {
  it('blocks when alias matches another ingredient primary name', () => {
    const a = baseIngredient({ id: 'a', name: 'coriander' });
    const b = baseIngredient({ id: 'b', name: 'cilantro', aliases: ['fresh coriander'] });
    const v = validateIngredientAliases({ ...a, aliases: ['cilantro'] }, [a, b]);
    expect(v.blockingReason).toBeDefined();
    expect(v.blockingReason).toContain('cilantro');
    expect(v.warnings).toHaveLength(0);
  });

  it('warns when alias overlaps another ingredient alias', () => {
    const a = baseIngredient({ id: 'a', name: 'scallion', aliases: ['green onion'] });
    const b = baseIngredient({ id: 'b', name: 'spring onion' });
    const v = validateIngredientAliases({ ...b, aliases: ['green onion'] }, [a, b]);
    expect(v.blockingReason).toBeUndefined();
    expect(v.warnings.length).toBeGreaterThan(0);
  });
});

describe('F065: ingredientMatchesQuery', () => {
  it('matches canonical name or alias substring', () => {
    const ing = baseIngredient({ name: 'eggplant', aliases: ['aubergine'] });
    expect(ingredientMatchesQuery(ing, 'egg')).toBe(true);
    expect(ingredientMatchesQuery(ing, 'auber')).toBe(true);
    expect(ingredientMatchesQuery(ing, 'zucchini')).toBe(false);
  });
});

describe('F065: mergeDuplicateMetadata unions aliases', () => {
  it('merges unique aliases into survivor', () => {
    const survivor = baseIngredient({ id: 's', name: 'onion', aliases: ['scallion'] });
    const dup = baseIngredient({
      id: 'd',
      name: 'onion dup',
      aliases: ['spring onion', 'scallion'],
    });
    const merged = mergeDuplicateMetadata(survivor, [dup]);
    expect(merged.aliases?.sort()).toEqual(['scallion', 'spring onion'].sort());
  });
});

describe('F065: matchIngredient household aliases', () => {
  it('matches query via household alias before catalog', () => {
    const household: Ingredient[] = [
      baseIngredient({ id: 'h1', name: 'eggplant', aliases: ['aubergine'] }),
    ];
    const m = matchIngredient('aubergine', household, []);
    expect(m.status).toBe('matched');
    expect(m.ingredient?.id).toBe('h1');
    expect(m.matchScore).toBeGreaterThanOrEqual(0.56);
  });

  it('matches Paprika line via household alias', () => {
    const household: Ingredient[] = [
      baseIngredient({ id: 'h1', name: 'coriander', aliases: ['cilantro'] }),
    ];
    const line = parsePaprikaLineFromRaw('1 bunch cilantro', 'R', 0, household);
    expect(line.status).toBe('matched');
    expect(line.matchedIngredient?.id).toBe('h1');
  });
});

describe('F065: sanitizeIngredientAliasesAgainstHousehold', () => {
  it('drops aliases that match another ingredient primary name', () => {
    const list = [
      baseIngredient({ id: 'a', name: 'coriander', aliases: ['cilantro', 'leaf'] }),
      baseIngredient({ id: 'b', name: 'cilantro' }),
    ];
    const out = sanitizeIngredientAliasesAgainstHousehold(list);
    const coriander = out.find((i) => i.id === 'a')!;
    expect(coriander.aliases).toEqual(['leaf']);
  });
});

describe('F065: parseRecipeText uses household aliases', () => {
  it('resolves a line to household ingredient via alias', () => {
    const household: Ingredient[] = [
      baseIngredient({ id: 'z1', name: 'zucchini', aliases: ['courgette'] }),
    ];
    const { lines } = parseRecipeText('2 courgettes, sliced', household);
    expect(lines[0]!.status).toBe('matched');
    expect(lines[0]!.matchedIngredient?.name).toBe('zucchini');
  });
});

describe('F065: storage round-trip', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('persists and reloads ingredients with aliases', () => {
    const ing = normalizeIngredientForStorage(
      baseIngredient({ id: 'i1', name: 'Coriander', aliases: ['  Cilantro  '] }),
    );
    const h: Household = {
      id: 'h-f065',
      name: 'Test',
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
      ingredients: [ing],
      baseMeals: [],
      weeklyPlans: [],
    };
    saveHousehold(h);
    const loaded = loadHousehold('h-f065')!;
    expect(loaded.ingredients[0]!.name).toBe('coriander');
    expect(loaded.ingredients[0]!.aliases).toEqual(['cilantro']);
  });

  it('loads legacy ingredients without aliases unchanged aside from name normalize', () => {
    const h: Household = {
      id: 'h-leg',
      name: 'Test',
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
      ingredients: [baseIngredient({ id: 'l1', name: 'rice' })],
      baseMeals: [],
      weeklyPlans: [],
    };
    saveHousehold(h);
    const loaded = loadHousehold('h-leg')!;
    expect(loaded.ingredients[0]!.aliases).toBeUndefined();
  });
});

function seedHouseholdTwoIngredients(): void {
  const h: Household = {
    id: 'h-f065-ui',
    name: 'Alias UI',
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
    ingredients: [
      baseIngredient({ id: 'ing-a', name: 'coriander' }),
      baseIngredient({ id: 'ing-b', name: 'cilantro' }),
    ],
    baseMeals: [],
    weeklyPlans: [],
  };
  saveHousehold(h);
}

function renderIngredientManager(householdId: string) {
  return render(
    <MemoryRouter initialEntries={[`/household/${householdId}/ingredients`]}>
      <Routes>
        <Route path="/household/:householdId/ingredients" element={<IngredientManager />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('F065: Ingredient Manager UI', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('adds and removes aliases and saves', async () => {
    seedHouseholdTwoIngredients();
    const user = userEvent.setup();
    renderIngredientManager('h-f065-ui');
    await user.type(screen.getByTestId('ingredient-search'), 'coriander');
    const row = await waitFor(() => screen.getByTestId('ingredient-row-ing-a'));
    await user.click(row);

    const modal = screen.getByTestId('ingredient-modal');
    const addInput = within(modal).getByTestId('alias-add-input');
    await user.type(addInput, 'fresh herb');
    await user.click(within(modal).getByTestId('alias-add-btn'));

    expect(within(modal).getByTestId('ingredient-alias-list')).toBeInTheDocument();
    await user.click(within(modal).getByTestId('alias-remove-fresh-herb'));

    await user.type(addInput, 'cilantro leaf');
    await user.click(within(modal).getByTestId('alias-add-btn'));
    await user.click(within(modal).getByTestId('ingredient-modal-done'));

    const saved = loadHousehold('h-f065-ui')!;
    const coriander = saved.ingredients.find((i) => i.id === 'ing-a')!;
    expect(coriander.aliases).toContain('cilantro leaf');
  });

  it('shows blocking error when alias equals another primary name', async () => {
    seedHouseholdTwoIngredients();
    const user = userEvent.setup();
    renderIngredientManager('h-f065-ui');
    await user.type(screen.getByTestId('ingredient-search'), 'coriander');
    await user.click(await waitFor(() => screen.getByTestId('ingredient-row-ing-a')));
    const modal = screen.getByTestId('ingredient-modal');
    await user.type(within(modal).getByTestId('alias-add-input'), 'cilantro');
    await user.click(within(modal).getByTestId('alias-add-btn'));

    expect(await screen.findByTestId('alias-blocking-error')).toBeInTheDocument();

    await user.click(within(modal).getByTestId('ingredient-modal-done'));
    const saved = loadHousehold('h-f065-ui')!;
    const coriander = saved.ingredients.find((i) => i.id === 'ing-a')!;
    expect(coriander.aliases?.includes('cilantro')).not.toBe(true);
  });

  it('finds ingredient by alias in browse search', async () => {
    seedHouseholdTwoIngredients();
    const user = userEvent.setup();
    const h = loadHousehold('h-f065-ui')!;
    h.ingredients = h.ingredients.map((i) =>
      i.id === 'ing-a' ? { ...i, aliases: ['cilantro leaf'] } : i,
    );
    saveHousehold(h);

    renderIngredientManager('h-f065-ui');
    const search = screen.getByTestId('ingredient-search');
    await user.type(search, 'cilantro leaf');

    expect(screen.getByTestId('ingredient-row-ing-a')).toBeInTheDocument();
    expect(screen.queryByTestId('ingredient-row-ing-b')).not.toBeInTheDocument();
  });
});
