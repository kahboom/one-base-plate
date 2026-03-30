import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { BaseMeal, Ingredient, HouseholdMember } from '../src/types';
import { generateShortReason } from '../src/planner';
import MealCard from '../src/components/MealCard';

const ingredients: Ingredient[] = [
  {
    id: 'ing-pasta',
    name: 'pasta',
    category: 'carb',
    tags: [],
    shelfLifeHint: '',
    freezerFriendly: false,
    babySafeWithAdaptation: true,
  },
  {
    id: 'ing-chicken',
    name: 'chicken breast',
    category: 'protein',
    tags: [],
    shelfLifeHint: '',
    freezerFriendly: true,
    babySafeWithAdaptation: false,
  },
  {
    id: 'ing-broccoli',
    name: 'broccoli',
    category: 'veg',
    tags: [],
    shelfLifeHint: '',
    freezerFriendly: true,
    babySafeWithAdaptation: true,
  },
  {
    id: 'ing-mushrooms',
    name: 'mushrooms',
    category: 'veg',
    tags: [],
    shelfLifeHint: '',
    freezerFriendly: false,
    babySafeWithAdaptation: false,
  },
];

const meal: BaseMeal = {
  id: 'meal-pasta',
  name: 'Pasta with chicken and veg',
  components: [
    { ingredientId: 'ing-pasta', role: 'carb', quantity: '400g' },
    { ingredientId: 'ing-chicken', role: 'protein', quantity: '500g' },
    { ingredientId: 'ing-broccoli', role: 'veg', quantity: '1 head' },
  ],
  defaultPrep: 'Cook pasta. Grill chicken. Steam veg.',
  estimatedTimeMinutes: 30,
  difficulty: 'easy',
  rescueEligible: true,
  wasteReuseHints: [],
};

const mealWithConflict: BaseMeal = {
  id: 'meal-mushroom',
  name: 'Mushroom pasta',
  components: [
    { ingredientId: 'ing-pasta', role: 'carb', quantity: '400g' },
    { ingredientId: 'ing-mushrooms', role: 'veg', quantity: '200g' },
  ],
  defaultPrep: 'Cook pasta with mushrooms',
  estimatedTimeMinutes: 20,
  difficulty: 'easy',
  rescueEligible: false,
  wasteReuseHints: [],
};

const members: HouseholdMember[] = [
  {
    id: 'm-alex',
    name: 'Alex',
    role: 'adult',
    safeFoods: ['pasta', 'chicken breast'],
    hardNoFoods: ['mushrooms'],
    preparationRules: [{ ingredient: 'chicken breast', rule: 'Must be sliced thin' }],
    textureLevel: 'regular',
    allergens: [],
    notes: '',
  },
  {
    id: 'm-jordan',
    name: 'Jordan',
    role: 'adult',
    safeFoods: ['pasta'],
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
    safeFoods: ['pasta', 'bread'],
    hardNoFoods: [],
    preparationRules: [],
    textureLevel: 'soft',
    allergens: [],
    notes: '',
  },
  {
    id: 'm-sam',
    name: 'Sam',
    role: 'baby',
    safeFoods: ['sweet potato', 'banana'],
    hardNoFoods: [],
    preparationRules: [],
    textureLevel: 'mashable',
    allergens: [],
    notes: '',
  },
];

function renderCard(mealToRender: BaseMeal = meal, compact = false) {
  return render(
    <MemoryRouter>
      <MealCard meal={mealToRender} members={members} ingredients={ingredients} compact={compact} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe('F023: MealCard displays meal info', () => {
  it('shows meal name, prep time, effort level, and overlap score', () => {
    renderCard();

    const card = screen.getByTestId('meal-card-meal-pasta');
    expect(within(card).getByText('Pasta with chicken and veg')).toBeInTheDocument();
    expect(within(card).getByTestId('prep-time')).toHaveTextContent('30 min');
    expect(within(card).getByTestId('effort-level')).toHaveTextContent('easy');
    expect(within(card).getByTestId('overlap-score')).toHaveTextContent(/\/4 overlap/);
  });

  it('displays compatibility chips for each household member', () => {
    renderCard();

    const chips = screen.getByTestId('compatibility-chips');
    expect(within(chips).getByTestId('chip-m-alex')).toBeInTheDocument();
    expect(within(chips).getByTestId('chip-m-jordan')).toBeInTheDocument();
    expect(within(chips).getByTestId('chip-m-riley')).toBeInTheDocument();
    expect(within(chips).getByTestId('chip-m-sam')).toBeInTheDocument();

    // Alex chip should show Adult role
    expect(within(chips).getByTestId('chip-m-alex')).toHaveTextContent('Alex (Adult)');
    // Riley chip should show Toddler role
    expect(within(chips).getByTestId('chip-m-riley')).toHaveTextContent('Riley (Toddler)');
    // Sam chip should show Baby role
    expect(within(chips).getByTestId('chip-m-sam')).toHaveTextContent('Sam (Baby)');
  });

  it('shows short reason explaining household fit', () => {
    renderCard();

    const reason = screen.getByTestId('short-reason');
    expect(reason.textContent).toBeTruthy();
    expect(reason.textContent!.length).toBeGreaterThan(0);
  });

  it('shows state chips for rescue eligible and needs extra prep', () => {
    renderCard();

    const stateChips = screen.getByTestId('state-chips');
    expect(within(stateChips).getByText('Rescue eligible')).toBeInTheDocument();
    expect(within(stateChips).getByText('Needs extra prep')).toBeInTheDocument();
  });

  it('shows high overlap chip when all members are compatible', () => {
    // Use only the two adults (no conflicts for pasta+chicken+broccoli without mushrooms)
    const twoAdults = members.filter((m) => m.role === 'adult');
    render(
      <MemoryRouter>
        <MealCard meal={meal} members={twoAdults} ingredients={ingredients} />
      </MemoryRouter>,
    );

    const stateChips = screen.getByTestId('state-chips');
    expect(within(stateChips).getByText('High overlap')).toBeInTheDocument();
  });

  it('shows conflict styling for members with hard-no foods', () => {
    renderCard(mealWithConflict);

    // Alex has mushrooms as hard-no
    const alexChip = screen.getByTestId('chip-m-alex');
    expect(alexChip).toBeInTheDocument();
    expect(alexChip.getAttribute('title')).toContain('mushrooms');
  });
});

describe('F023: MealCard compact mode', () => {
  it('renders without action buttons in compact mode', () => {
    renderCard(meal, true);

    expect(screen.queryByTestId('assign-meal-pasta')).not.toBeInTheDocument();
    expect(screen.queryByTestId('open-meal-pasta')).not.toBeInTheDocument();
  });
});

describe('F023: MealCard action buttons', () => {
  it('shows assign and details buttons when handlers provided', () => {
    const onAssign = () => {};
    const onOpen = () => {};
    render(
      <MemoryRouter>
        <MealCard
          meal={meal}
          members={members}
          ingredients={ingredients}
          onAssign={onAssign}
          onOpen={onOpen}
        />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('assign-meal-pasta')).toBeInTheDocument();
    expect(screen.getByTestId('open-meal-pasta')).toBeInTheDocument();
  });
});

describe('F023: generateShortReason', () => {
  it('returns fit reason for full compatibility meal', () => {
    const twoAdults = members.filter((m) => m.role === 'adult');
    const reason = generateShortReason(meal, twoAdults, ingredients);
    expect(reason).toBeTruthy();
  });

  it('returns toddler safe food reason when applicable', () => {
    // Meal with pasta (Riley's safe food), only Riley
    const riley = members.filter((m) => m.id === 'm-riley');
    const reason = generateShortReason(meal, riley, ingredients);
    expect(reason).toContain('safe food included');
  });

  it('returns partial fit message when conflicts exist', () => {
    const reason = generateShortReason(mealWithConflict, members, ingredients);
    expect(reason).toContain('Fits');
  });

  it('returns conflict message when no members fit', () => {
    const allConflict: HouseholdMember[] = [
      {
        id: 'm-x',
        name: 'X',
        role: 'adult',
        safeFoods: [],
        hardNoFoods: ['pasta', 'mushrooms'],
        preparationRules: [],
        textureLevel: 'regular',
        allergens: [],
        notes: '',
      },
    ];
    const reason = generateShortReason(mealWithConflict, allConflict, ingredients);
    // F074: hard-no detail surfaces instead of generic conflict message
    expect(reason).toContain('hard-no');
  });
});
