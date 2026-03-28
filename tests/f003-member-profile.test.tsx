import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import type { Household } from '../src/types';
import { saveHousehold, loadHousehold } from '../src/storage';
import MemberProfile from '../src/pages/MemberProfile';

function seedHousehold(): Household {
  const household: Household = {
    id: 'h-profile',
    name: 'Profile Test Family',
    members: [
      {
        id: 'm-alex',
        name: 'Alex',
        role: 'adult',
        safeFoods: [],
        hardNoFoods: [],
        preparationRules: [],
        textureLevel: 'regular',
        allergens: [],
        notes: '',
      },
      {
        id: 'm-riley',
        name: 'Riley',
        role: 'toddler',
        safeFoods: ['pasta'],
        hardNoFoods: ['mushrooms'],
        preparationRules: [{ ingredient: 'carrots', rule: 'must be steamed' }],
        textureLevel: 'soft',
        allergens: [],
        notes: '',
      },
    ],
    ingredients: [],
    baseMeals: [],
    weeklyPlans: [],
  };
  saveHousehold(household);
  return household;
}

function seedHouseholdWithCatalogIngredients(): Household {
  const household: Household = {
    id: 'h-profile',
    name: 'Profile Test Family',
    members: [
      {
        id: 'm-alex',
        name: 'Alex',
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
      {
        id: 'ing-chicken',
        name: 'chicken',
        category: 'protein',
        tags: [],
        shelfLifeHint: '',
        freezerFriendly: false,
        babySafeWithAdaptation: true,
        source: 'manual',
      },
      {
        id: 'ing-beef',
        name: 'beef',
        category: 'protein',
        tags: [],
        shelfLifeHint: '',
        freezerFriendly: false,
        babySafeWithAdaptation: true,
        source: 'manual',
      },
    ],
    baseMeals: [],
    weeklyPlans: [],
  };
  saveHousehold(household);
  return household;
}

function renderMemberProfile(householdId: string, memberId: string) {
  return render(
    <MemoryRouter initialEntries={[`/household/${householdId}/member/${memberId}`]}>
      <Routes>
        <Route path="/household/:householdId/member/:memberId" element={<MemberProfile />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe('F003: Member profile — safe foods', () => {
  it('can add safe foods and persist them', async () => {
    seedHousehold();
    const user = userEvent.setup();
    renderMemberProfile('h-profile', 'm-alex');

    expect(screen.getByText('Alex — adult')).toBeInTheDocument();

    const input = screen.getByPlaceholderText('Add safe food');
    await user.type(input, 'rice');
    await user.click(screen.getByText('Add safe food'));

    await user.type(input, 'chicken');
    await user.click(screen.getByText('Add safe food'));

    const list = screen.getByTestId('safe-foods-list');
    expect(within(list).getByText('rice')).toBeInTheDocument();
    expect(within(list).getByText('chicken')).toBeInTheDocument();

    const saved = loadHousehold('h-profile');
    const alex = saved!.members.find((m) => m.id === 'm-alex')!;
    expect(alex.safeFoods).toEqual(['rice', 'chicken']);
  });

  it('can remove a safe food', async () => {
    seedHousehold();
    const user = userEvent.setup();
    renderMemberProfile('h-profile', 'm-riley');

    const list = screen.getByTestId('safe-foods-list');
    expect(within(list).getByText('pasta')).toBeInTheDocument();

    const removeButton = within(list).getByRole('button', { name: 'Remove safe food pasta' });
    await user.click(removeButton);

    const dialog = screen.getByRole('dialog', { name: 'Remove food' });
    await user.click(within(dialog).getByText('Remove'));

    expect(within(list).queryByText('pasta')).not.toBeInTheDocument();
  });

  it('can cancel safe food removal', async () => {
    seedHousehold();
    const user = userEvent.setup();
    renderMemberProfile('h-profile', 'm-riley');

    const list = screen.getByTestId('safe-foods-list');
    expect(within(list).getByText('pasta')).toBeInTheDocument();

    const removeButton = within(list).getByRole('button', { name: 'Remove safe food pasta' });
    await user.click(removeButton);

    const dialog = screen.getByRole('dialog', { name: 'Remove food' });
    await user.click(within(dialog).getByText('Cancel'));

    expect(screen.queryByRole('dialog', { name: 'Remove food' })).not.toBeInTheDocument();
    expect(within(list).getByText('pasta')).toBeInTheDocument();
  });

  it('can pick a safe food from the household ingredient list', async () => {
    seedHouseholdWithCatalogIngredients();
    const user = userEvent.setup();
    renderMemberProfile('h-profile', 'm-alex');

    const input = screen.getByPlaceholderText('Add safe food');
    await user.click(input);
    await user.click(screen.getByRole('option', { name: 'Chicken' }));

    const list = screen.getByTestId('safe-foods-list');
    expect(within(list).getByText('chicken')).toBeInTheDocument();

    const saved = loadHousehold('h-profile')!;
    const alex = saved.members.find((m) => m.id === 'm-alex')!;
    expect(alex.safeFoods).toEqual(['chicken']);
  });

  it('can create a new ingredient in the catalog when adding a safe food', async () => {
    seedHousehold();
    const user = userEvent.setup();
    renderMemberProfile('h-profile', 'm-alex');

    const input = screen.getByPlaceholderText('Add safe food');
    await user.type(input, 'quinoa');
    await user.click(screen.getByRole('option', { name: /Create .* in ingredient list and use/ }));

    const saved = loadHousehold('h-profile')!;
    expect(saved.ingredients.some((i) => i.name === 'quinoa')).toBe(true);
    const alex = saved.members.find((m) => m.id === 'm-alex')!;
    expect(alex.safeFoods).toEqual(['quinoa']);
  });
});

describe('F003: Member profile — hard-no foods', () => {
  it('can add hard-no foods and persist them', async () => {
    seedHousehold();
    const user = userEvent.setup();
    renderMemberProfile('h-profile', 'm-alex');

    const input = screen.getByPlaceholderText('Add hard-no food');
    await user.type(input, 'olives');
    await user.click(screen.getByText('Add hard-no food'));

    await user.type(input, 'blue cheese');
    await user.click(screen.getByText('Add hard-no food'));

    const list = screen.getByTestId('hard-no-foods-list');
    expect(within(list).getByText('olives')).toBeInTheDocument();
    expect(within(list).getByText('blue cheese')).toBeInTheDocument();

    const saved = loadHousehold('h-profile');
    const alex = saved!.members.find((m) => m.id === 'm-alex')!;
    expect(alex.hardNoFoods).toEqual(['olives', 'blue cheese']);
  });

  it('can pick a hard-no from the household ingredient list', async () => {
    seedHouseholdWithCatalogIngredients();
    const user = userEvent.setup();
    renderMemberProfile('h-profile', 'm-alex');

    const input = screen.getByPlaceholderText('Add hard-no food');
    await user.click(input);
    await user.click(screen.getByRole('option', { name: 'Beef' }));

    const list = screen.getByTestId('hard-no-foods-list');
    expect(within(list).getByText('beef')).toBeInTheDocument();

    const saved = loadHousehold('h-profile')!;
    const alex = saved.members.find((m) => m.id === 'm-alex')!;
    expect(alex.hardNoFoods).toEqual(['beef']);
  });

  it('can create a new ingredient in the catalog when adding a hard-no', async () => {
    seedHousehold();
    const user = userEvent.setup();
    renderMemberProfile('h-profile', 'm-alex');

    const input = screen.getByPlaceholderText('Add hard-no food');
    await user.type(input, 'shellfish');
    await user.click(screen.getByRole('option', { name: /Create .* in ingredient list and use/ }));

    const saved = loadHousehold('h-profile')!;
    expect(saved.ingredients.some((i) => i.name === 'shellfish')).toBe(true);
    const alex = saved.members.find((m) => m.id === 'm-alex')!;
    expect(alex.hardNoFoods).toEqual(['shellfish']);
  });

  it('can remove a hard-no food', async () => {
    seedHousehold();
    const user = userEvent.setup();
    renderMemberProfile('h-profile', 'm-riley');

    const list = screen.getByTestId('hard-no-foods-list');
    expect(within(list).getByText('mushrooms')).toBeInTheDocument();

    const removeButton = within(list).getByRole('button', {
      name: 'Remove hard-no food mushrooms',
    });
    await user.click(removeButton);

    const dialog = screen.getByRole('dialog', { name: 'Remove food' });
    await user.click(within(dialog).getByText('Remove'));

    expect(within(list).queryByText('mushrooms')).not.toBeInTheDocument();
  });

  it('can cancel hard-no food removal', async () => {
    seedHousehold();
    const user = userEvent.setup();
    renderMemberProfile('h-profile', 'm-riley');

    const list = screen.getByTestId('hard-no-foods-list');
    expect(within(list).getByText('mushrooms')).toBeInTheDocument();

    const removeButton = within(list).getByRole('button', {
      name: 'Remove hard-no food mushrooms',
    });
    await user.click(removeButton);

    const dialog = screen.getByRole('dialog', { name: 'Remove food' });
    await user.click(within(dialog).getByText('Cancel'));

    expect(screen.queryByRole('dialog', { name: 'Remove food' })).not.toBeInTheDocument();
    expect(within(list).getByText('mushrooms')).toBeInTheDocument();
  });
});

describe('F003: Member profile — preparation rules', () => {
  it('can add preparation rules and persist them', async () => {
    seedHousehold();
    const user = userEvent.setup();
    renderMemberProfile('h-profile', 'm-alex');

    const ingredientInput = screen.getByPlaceholderText('Ingredient');
    const ruleInput = screen.getByPlaceholderText('Preparation rule');

    await user.type(ingredientInput, 'broccoli');
    await user.type(ruleInput, 'must not touch other food');
    await user.click(screen.getByText('Add rule'));

    await user.type(ingredientInput, 'pasta');
    await user.type(ruleInput, 'plain with no sauce');
    await user.click(screen.getByText('Add rule'));

    const list = screen.getByTestId('preparation-rules-list');
    expect(within(list).getByText(/broccoli/)).toBeInTheDocument();
    expect(within(list).getByText(/must not touch other food/)).toBeInTheDocument();
    expect(within(list).getByText(/pasta/)).toBeInTheDocument();
    expect(within(list).getByText(/plain with no sauce/)).toBeInTheDocument();

    const saved = loadHousehold('h-profile');
    const alex = saved!.members.find((m) => m.id === 'm-alex')!;
    expect(alex.preparationRules).toEqual([
      { ingredient: 'broccoli', rule: 'must not touch other food' },
      { ingredient: 'pasta', rule: 'plain with no sauce' },
    ]);
  });

  it('can set the ingredient from the catalog and add the rule', async () => {
    seedHouseholdWithCatalogIngredients();
    const user = userEvent.setup();
    renderMemberProfile('h-profile', 'm-alex');

    const ingredientInput = screen.getByPlaceholderText('Ingredient');
    await user.click(ingredientInput);
    await user.click(screen.getByRole('option', { name: 'Chicken' }));

    await user.type(screen.getByPlaceholderText('Preparation rule'), 'grill only');
    await user.click(screen.getByText('Add rule'));

    const saved = loadHousehold('h-profile')!;
    const alex = saved.members.find((m) => m.id === 'm-alex')!;
    expect(alex.preparationRules).toEqual([{ ingredient: 'chicken', rule: 'grill only' }]);
  });

  it('can create a catalog ingredient from the preparation-rule ingredient field', async () => {
    seedHousehold();
    const user = userEvent.setup();
    renderMemberProfile('h-profile', 'm-alex');

    const ingredientInput = screen.getByPlaceholderText('Ingredient');
    await user.type(ingredientInput, 'tofu');
    await user.click(screen.getByRole('option', { name: /Create .* in ingredient list and use/ }));

    await user.type(screen.getByPlaceholderText('Preparation rule'), 'press dry first');
    await user.click(screen.getByText('Add rule'));

    const saved = loadHousehold('h-profile')!;
    expect(saved.ingredients.some((i) => i.name === 'tofu')).toBe(true);
    const alex = saved.members.find((m) => m.id === 'm-alex')!;
    expect(alex.preparationRules).toEqual([{ ingredient: 'tofu', rule: 'press dry first' }]);
  });

  it('can remove a preparation rule', async () => {
    seedHousehold();
    const user = userEvent.setup();
    renderMemberProfile('h-profile', 'm-riley');

    const list = screen.getByTestId('preparation-rules-list');
    expect(within(list).getByText(/carrots/)).toBeInTheDocument();
    expect(within(list).getByText(/must be steamed/)).toBeInTheDocument();

    const removeButton = within(list).getByText('Remove');
    await user.click(removeButton);

    expect(within(list).queryByText(/carrots/)).not.toBeInTheDocument();
  });
});

describe('F003: Constraints persist across re-open', () => {
  it('re-opening a profile shows all previously saved constraints', async () => {
    const household = seedHousehold();
    // Pre-populate Alex with constraints
    household.members[0]!.safeFoods = ['rice', 'bread'];
    household.members[0]!.hardNoFoods = ['olives', 'anchovies'];
    household.members[0]!.preparationRules = [
      { ingredient: 'chicken', rule: 'must be well done' },
      { ingredient: 'eggs', rule: 'scrambled only' },
    ];
    saveHousehold(household);

    renderMemberProfile('h-profile', 'm-alex');

    // Verify safe foods
    const safeList = screen.getByTestId('safe-foods-list');
    expect(within(safeList).getByText('rice')).toBeInTheDocument();
    expect(within(safeList).getByText('bread')).toBeInTheDocument();

    // Verify hard-no foods
    const hardNoList = screen.getByTestId('hard-no-foods-list');
    expect(within(hardNoList).getByText('olives')).toBeInTheDocument();
    expect(within(hardNoList).getByText('anchovies')).toBeInTheDocument();

    // Verify preparation rules
    const rulesList = screen.getByTestId('preparation-rules-list');
    expect(within(rulesList).getByText(/chicken/)).toBeInTheDocument();
    expect(within(rulesList).getByText(/must be well done/)).toBeInTheDocument();
    expect(within(rulesList).getByText(/eggs/)).toBeInTheDocument();
    expect(within(rulesList).getByText(/scrambled only/)).toBeInTheDocument();
  });
});
