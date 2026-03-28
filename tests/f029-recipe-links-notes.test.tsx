import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import type { Household } from '../src/types';
import { saveHousehold, loadHousehold } from '../src/storage';
import BaseMealManager from '../src/pages/BaseMealManager';
import MealDetail from '../src/pages/MealDetail';

function seedHousehold(): Household {
  const household: Household = {
    id: 'h-rl',
    name: 'Recipe Links Family',
    members: [
      {
        id: 'm-adult',
        name: 'Parent',
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
        name: 'Chicken',
        category: 'protein',
        tags: [],
        shelfLifeHint: '',
        freezerFriendly: true,
        babySafeWithAdaptation: false,
      },
      {
        id: 'ing-rice',
        name: 'Rice',
        category: 'carb',
        tags: [],
        shelfLifeHint: '',
        freezerFriendly: false,
        babySafeWithAdaptation: true,
      },
    ],
    baseMeals: [
      {
        id: 'meal-basic',
        name: 'Chicken Rice',
        components: [
          { ingredientId: 'ing-chicken', role: 'protein', quantity: '300g' },
          { ingredientId: 'ing-rice', role: 'carb', quantity: '200g' },
        ],
        defaultPrep: 'pan-fry',
        estimatedTimeMinutes: 20,
        difficulty: 'easy',
        rescueEligible: true,
        wasteReuseHints: [],
        recipeLinks: [
          { label: 'Gousto version', url: 'https://gousto.example.com/chicken-rice' },
          { label: 'BBC Good Food', url: 'https://bbcgoodfood.example.com/chicken-rice' },
        ],
        notes: 'Gousto version works well. Blend toddler sauce smooth.',
      },
    ],
    weeklyPlans: [],
  };
  saveHousehold(household);
  return household;
}

function seedHouseholdNoLinks(): Household {
  const household: Household = {
    id: 'h-nl',
    name: 'No Links Family',
    members: [
      {
        id: 'm-adult',
        name: 'Parent',
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
        id: 'ing-pasta',
        name: 'Pasta',
        category: 'carb',
        tags: [],
        shelfLifeHint: '',
        freezerFriendly: false,
        babySafeWithAdaptation: true,
      },
    ],
    baseMeals: [
      {
        id: 'meal-plain',
        name: 'Plain Pasta',
        components: [{ ingredientId: 'ing-pasta', role: 'carb', quantity: '400g' }],
        defaultPrep: 'boil',
        estimatedTimeMinutes: 15,
        difficulty: 'easy',
        rescueEligible: true,
        wasteReuseHints: [],
      },
    ],
    weeklyPlans: [],
  };
  saveHousehold(household);
  return household;
}

beforeEach(() => {
  localStorage.clear();
});

describe('F029: Recipe links in Base Meal Editor', () => {
  it('can add recipe links with label and url', async () => {
    seedHouseholdNoLinks();
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/household/h-nl/meals']}>
        <Routes>
          <Route path="/household/:householdId/meals" element={<BaseMealManager />} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByTestId('meal-row-meal-plain'));
    const modal = screen.getByTestId('meal-modal');
    await user.click(within(modal).getByTestId('recipe-links-section').querySelector('summary')!);
    const editor = within(modal).getByTestId('recipe-links-editor');
    const labelInput = within(editor).getByTestId('recipe-link-label');
    const urlInput = within(editor).getByTestId('recipe-link-url');

    await user.type(labelInput, 'Gousto');
    await user.type(urlInput, 'https://gousto.example.com/pasta');
    await user.click(within(editor).getByText('Add link'));

    expect(within(editor).getByText('Gousto')).toBeInTheDocument();

    // Auto-save persists on change
    const saved = loadHousehold('h-nl')!;
    expect(saved.baseMeals[0]!.recipeLinks).toHaveLength(1);
    expect(saved.baseMeals[0]!.recipeLinks![0]!.label).toBe('Gousto');
    expect(saved.baseMeals[0]!.recipeLinks![0]!.url).toBe('https://gousto.example.com/pasta');
  });

  it('can add multiple recipe links from different sources', async () => {
    seedHouseholdNoLinks();
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/household/h-nl/meals']}>
        <Routes>
          <Route path="/household/:householdId/meals" element={<BaseMealManager />} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByTestId('meal-row-meal-plain'));
    const modal = screen.getByTestId('meal-modal');
    await user.click(within(modal).getByTestId('recipe-links-section').querySelector('summary')!);
    const editor = within(modal).getByTestId('recipe-links-editor');

    // Add first link
    await user.type(within(editor).getByTestId('recipe-link-label'), 'Gousto');
    await user.type(within(editor).getByTestId('recipe-link-url'), 'https://gousto.example.com');
    await user.click(within(editor).getByText('Add link'));

    // Add second link
    await user.type(within(editor).getByTestId('recipe-link-label'), 'BBC Good Food');
    await user.type(within(editor).getByTestId('recipe-link-url'), 'https://bbc.example.com');
    await user.click(within(editor).getByText('Add link'));

    expect(within(editor).getByText('Gousto')).toBeInTheDocument();
    expect(within(editor).getByText('BBC Good Food')).toBeInTheDocument();

    // Auto-save persists on change
    const saved = loadHousehold('h-nl')!;
    expect(saved.baseMeals[0]!.recipeLinks).toHaveLength(2);
  });

  it('can remove a recipe link', async () => {
    seedHousehold();
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/household/h-rl/meals']}>
        <Routes>
          <Route path="/household/:householdId/meals" element={<BaseMealManager />} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByTestId('meal-row-meal-basic'));
    const modal = screen.getByTestId('meal-modal');
    await user.click(within(modal).getByTestId('recipe-links-section').querySelector('summary')!);

    // Should start with 2 links
    expect(within(modal).getByTestId('recipe-link-0')).toBeInTheDocument();
    expect(within(modal).getByTestId('recipe-link-1')).toBeInTheDocument();

    // Remove the first link
    const firstLink = within(modal).getByTestId('recipe-link-0');
    await user.click(within(firstLink).getByText('x'));

    // Auto-save persists on change
    const saved = loadHousehold('h-rl')!;
    expect(saved.baseMeals[0]!.recipeLinks).toHaveLength(1);
    expect(saved.baseMeals[0]!.recipeLinks![0]!.label).toBe('BBC Good Food');
  });

  it('uses url as label when label is empty', async () => {
    seedHouseholdNoLinks();
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/household/h-nl/meals']}>
        <Routes>
          <Route path="/household/:householdId/meals" element={<BaseMealManager />} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByTestId('meal-row-meal-plain'));
    const modal = screen.getByTestId('meal-modal');
    await user.click(within(modal).getByTestId('recipe-links-section').querySelector('summary')!);
    const editor = within(modal).getByTestId('recipe-links-editor');
    await user.type(within(editor).getByTestId('recipe-link-url'), 'https://example.com/recipe');
    await user.click(within(editor).getByText('Add link'));

    // Auto-save persists on change
    const saved = loadHousehold('h-nl')!;
    expect(saved.baseMeals[0]!.recipeLinks![0]!.label).toBe('https://example.com/recipe');
  });
});

describe('F029: Notes in Base Meal Editor', () => {
  it('can add preparation notes to a meal', async () => {
    seedHouseholdNoLinks();
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/household/h-nl/meals']}>
        <Routes>
          <Route path="/household/:householdId/meals" element={<BaseMealManager />} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByTestId('meal-row-meal-plain'));
    const modal = screen.getByTestId('meal-modal');
    await user.click(within(modal).getByTestId('notes-section').querySelector('summary')!);
    const notesArea = within(modal).getByTestId('meal-notes');
    await user.type(notesArea, 'Blend toddler sauce smooth');

    // Auto-save persists on change
    const saved = loadHousehold('h-nl')!;
    expect(saved.baseMeals[0]!.notes).toBe('Blend toddler sauce smooth');
  });

  it('persists notes across reopen', async () => {
    seedHousehold();
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/household/h-rl/meals']}>
        <Routes>
          <Route path="/household/:householdId/meals" element={<BaseMealManager />} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByTestId('meal-row-meal-basic'));
    const modal = screen.getByTestId('meal-modal');
    await user.click(within(modal).getByTestId('notes-section').querySelector('summary')!);
    const notesArea = within(modal).getByTestId('meal-notes') as HTMLTextAreaElement;
    expect(notesArea.value).toBe('Gousto version works well. Blend toddler sauce smooth.');
  });
});

describe('F029: Meal Detail shows recipe links and notes', () => {
  it('displays recipe links that open in new tab', () => {
    seedHousehold();
    render(
      <MemoryRouter initialEntries={['/household/h-rl/meal/meal-basic']}>
        <Routes>
          <Route path="/household/:householdId/meal/:mealId" element={<MealDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    const linksSection = screen.getByTestId('recipe-links');
    const link0 = within(linksSection).getByTestId('recipe-link-0');
    expect(link0).toHaveTextContent('Gousto version');
    expect(link0).toHaveAttribute('href', 'https://gousto.example.com/chicken-rice');
    expect(link0).toHaveAttribute('target', '_blank');

    const link1 = within(linksSection).getByTestId('recipe-link-1');
    expect(link1).toHaveTextContent('BBC Good Food');
  });

  it('displays notes section', () => {
    seedHousehold();
    render(
      <MemoryRouter initialEntries={['/household/h-rl/meal/meal-basic']}>
        <Routes>
          <Route path="/household/:householdId/meal/:mealId" element={<MealDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    const notes = screen.getByTestId('meal-notes');
    expect(notes).toHaveTextContent('Gousto version works well. Blend toddler sauce smooth.');
  });

  it('hides recipe links section when no links exist', () => {
    seedHouseholdNoLinks();
    render(
      <MemoryRouter initialEntries={['/household/h-nl/meal/meal-plain']}>
        <Routes>
          <Route path="/household/:householdId/meal/:mealId" element={<MealDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.queryByTestId('recipe-links')).not.toBeInTheDocument();
  });

  it('hides notes section when notes are empty', () => {
    seedHouseholdNoLinks();
    render(
      <MemoryRouter initialEntries={['/household/h-nl/meal/meal-plain']}>
        <Routes>
          <Route path="/household/:householdId/meal/:mealId" element={<MealDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.queryByTestId('meal-notes')).not.toBeInTheDocument();
  });

  it('recipe links are visible but do not dominate the page', () => {
    seedHousehold();
    render(
      <MemoryRouter initialEntries={['/household/h-rl/meal/meal-basic']}>
        <Routes>
          <Route path="/household/:householdId/meal/:mealId" element={<MealDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    // Recipe links section exists but meal structure and variants are still prominent
    expect(screen.getByTestId('recipe-links')).toBeInTheDocument();
    expect(screen.getByTestId('meal-structure')).toBeInTheDocument();
    expect(screen.getByTestId('member-variants')).toBeInTheDocument();
    expect(screen.getByTestId('meal-hero')).toBeInTheDocument();
  });
});
