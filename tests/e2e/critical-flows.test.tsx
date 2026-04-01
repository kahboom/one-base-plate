/**
 * End-to-end tests for all critical planning flows using deterministic fixture data.
 * Covers F017 acceptance: household setup, base meal planning, rescue mode, grocery list.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes } from 'react-router-dom';
import type { Household } from '../../src/types';
import { saveHousehold, loadHousehold } from '../../src/storage';
import {
  generateAssemblyVariants,
  generateWeeklyPlan,
  generateRescueMeals,
  generateGroceryList,
  computeMealOverlap,
} from '../../src/planner';

import seedData from '../../src/seed-data.json';
import { householdLayoutRouteBranch } from '../householdLayoutRoutes';

function loadFixture(): Household {
  const h = (seedData as Household[]).find((household) => household.id === 'H002') as Household;
  saveHousehold(h);
  return h;
}

function renderRoute(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>{householdLayoutRouteBranch}</Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe('E2E: Household setup flow', () => {
  it('loads fixture household with all four members and displays them', () => {
    loadFixture();
    renderRoute('/household/H002');

    expect(screen.getByDisplayValue('Two adults, toddler, and baby')).toBeInTheDocument();
    expect(screen.getByText('Alex')).toBeInTheDocument();
    expect(screen.getByText('Jordan')).toBeInTheDocument();
    expect(screen.getByText('Riley')).toBeInTheDocument();
    expect(screen.getByText('Sam')).toBeInTheDocument();
  });

  it('persists member constraints through save and reload', () => {
    const h = loadFixture();
    const alex = h.members.find((m) => m.id === 'M001')!;
    expect(alex.hardNoFoods).toContain('mushrooms');
    expect(alex.hardNoFoods).toContain('blue cheese');
    expect(alex.preparationRules.length).toBe(2);
    expect(alex.preparationRules[0]!.ingredient).toBe('chicken breast');

    const reloaded = loadHousehold('H002')!;
    const alexReloaded = reloaded.members.find((m) => m.id === 'M001')!;
    expect(alexReloaded.hardNoFoods).toEqual(alex.hardNoFoods);
    expect(alexReloaded.preparationRules).toEqual(alex.preparationRules);
  });

  it('fixture includes all role types (adult, toddler, baby)', () => {
    const h = loadFixture();
    const roles = h.members.map((m) => m.role);
    expect(roles).toContain('adult');
    expect(roles).toContain('toddler');
    expect(roles).toContain('baby');
  });

  it('fixture includes conflicting constraints across members', () => {
    const h = loadFixture();
    const alex = h.members.find((m) => m.id === 'M001')!;
    const jordan = h.members.find((m) => m.id === 'M002')!;
    expect(alex.hardNoFoods).toContain('mushrooms');
    expect(jordan.safeFoods).toContain('mushrooms');
  });
});

describe('E2E: Base meal planning flow', () => {
  it('generates assembly variants for all fixture members from a base meal', () => {
    const h = loadFixture();
    const meal = h.baseMeals.find((m) => m.id === 'bm-pasta-chicken')!;
    const variants = generateAssemblyVariants(meal, h.members, h.ingredients);

    expect(variants.length).toBe(4);
    const memberIds = variants.map((v) => v.memberId);
    expect(memberIds).toContain('M001');
    expect(memberIds).toContain('M002');
    expect(memberIds).toContain('M003');
    expect(memberIds).toContain('M004');
  });

  it('Alex variant includes preparation rule modifications', () => {
    const h = loadFixture();
    const meal = h.baseMeals.find((m) => m.id === 'bm-pasta-chicken')!;
    const variants = generateAssemblyVariants(meal, h.members, h.ingredients);
    const alexVariant = variants.find((v) => v.memberId === 'M001')!;

    const hasChickenRule = alexVariant.instructions.some(
      (i) => i.includes('chicken breast') && i.includes('sliced thin'),
    );
    expect(hasChickenRule).toBe(true);
    expect(alexVariant.requiresExtraPrep).toBe(true);
  });

  it('Riley toddler variant includes safe food detection', () => {
    const h = loadFixture();
    const meal = h.baseMeals.find((m) => m.id === 'bm-pasta-chicken')!;
    const variants = generateAssemblyVariants(meal, h.members, h.ingredients);
    const rileyVariant = variants.find((v) => v.memberId === 'M003')!;

    expect(rileyVariant.safeFoodIncluded).toBe(true);
    const hasSafeFoodInst = rileyVariant.instructions.some(
      (i) => i.includes('Includes safe food') && i.includes('pasta'),
    );
    expect(hasSafeFoodInst).toBe(true);
  });

  it('Sam baby variant includes texture adaptation guidance', () => {
    const h = loadFixture();
    const meal = h.baseMeals.find((m) => m.id === 'bm-pasta-chicken')!;
    const variants = generateAssemblyVariants(meal, h.members, h.ingredients);
    const samVariant = variants.find((v) => v.memberId === 'M004')!;

    expect(samVariant.requiresExtraPrep).toBe(true);
    const hasTextureInst = samVariant.instructions.some(
      (i) =>
        i.includes('soft') ||
        i.includes('mash') ||
        i.includes('finger-safe') ||
        i.includes('shred') ||
        i.includes('blend'),
    );
    expect(hasTextureInst).toBe(true);
  });

  it('overlap score reflects household compatibility', () => {
    const h = loadFixture();
    const meal = h.baseMeals.find((m) => m.id === 'bm-pasta-chicken')!;
    const overlap = computeMealOverlap(meal, h.members, h.ingredients);

    expect(overlap.total).toBe(4);
    expect(overlap.score).toBe(4);
  });

  it('planner page renders meal cards from fixture', () => {
    loadFixture();
    renderRoute('/household/H002/planner');

    expect(screen.getByTestId('meal-card-bm-pasta-chicken')).toBeInTheDocument();
    expect(screen.getByTestId('meal-card-bm-salmon-rice')).toBeInTheDocument();
    expect(screen.getByTestId('meal-card-bm-fishfingers')).toBeInTheDocument();
  });

  it('selecting a meal card shows per-member assembly variants', async () => {
    loadFixture();
    const user = userEvent.setup();
    renderRoute('/household/H002/planner');

    await user.click(screen.getByTestId('meal-card-bm-pasta-chicken'));

    expect(screen.getByTestId('variant-M001')).toBeInTheDocument();
    expect(screen.getByTestId('variant-M002')).toBeInTheDocument();
    expect(screen.getByTestId('variant-M003')).toBeInTheDocument();
    expect(screen.getByTestId('variant-M004')).toBeInTheDocument();
  });
});

describe('E2E: Weekly plan generation flow', () => {
  it('generates a 7-day plan from fixture meals', () => {
    const h = loadFixture();
    const plan = generateWeeklyPlan(h.baseMeals, h.members, h.ingredients, 7);

    expect(plan.length).toBe(7);
    for (const day of plan) {
      expect(day.baseMealId).toBeTruthy();
      expect(day.variants.length).toBe(4);
    }
  });

  it('weekly plan avoids consecutive repeats when possible', () => {
    const h = loadFixture();
    const plan = generateWeeklyPlan(h.baseMeals, h.members, h.ingredients, 7);

    for (let i = 1; i < plan.length; i++) {
      if (h.baseMeals.length > 1) {
        expect(plan[i]!.baseMealId).not.toBe(plan[i - 1]!.baseMealId);
      }
    }
  });

  it('weekly planner page renders with fixture data', async () => {
    loadFixture();
    const user = userEvent.setup();
    renderRoute('/household/H002/weekly');

    await user.click(screen.getByText('Generate plan'));

    expect(screen.getByTestId('day-monday')).toBeInTheDocument();
    expect(screen.getByTestId('day-sunday')).toBeInTheDocument();
  });

  it('generated plan can be saved and reloaded', async () => {
    loadFixture();
    const user = userEvent.setup();
    renderRoute('/household/H002/weekly');

    await user.click(screen.getByText('Generate plan'));
    await user.click(screen.getByText('Save plan'));

    const saved = loadHousehold('H002')!;
    expect(saved.weeklyPlans.length).toBeGreaterThan(0);
    const latestPlan = saved.weeklyPlans[saved.weeklyPlans.length - 1]!;
    expect(latestPlan.days.length).toBe(7);
  });
});

describe('E2E: Rescue mode flow', () => {
  it('generates rescue meals prioritizing staples from fixture', () => {
    const h = loadFixture();
    const results = generateRescueMeals(h.baseMeals, h.members, h.ingredients, 'low-time');

    expect(results.length).toBeGreaterThan(0);
    const fishfingersResult = results.find((r) => r.meal.id === 'bm-fishfingers');
    expect(fishfingersResult).toBeDefined();
  });

  it('rescue results include per-person assemblies for all fixture members', () => {
    const h = loadFixture();
    const results = generateRescueMeals(h.baseMeals, h.members, h.ingredients, 'low-energy');

    for (const result of results) {
      expect(result.variants.length).toBe(4);
      const memberIds = result.variants.map((v) => v.memberId);
      expect(memberIds).toContain('M001');
      expect(memberIds).toContain('M003');
      expect(memberIds).toContain('M004');
    }
  });

  it('rescue mode page renders scenario picker and shows results', async () => {
    loadFixture();
    const user = userEvent.setup();
    renderRoute('/household/H002/rescue');

    expect(screen.getByTestId('scenario-picker')).toBeInTheDocument();

    await user.click(screen.getByTestId('scenario-low-time'));

    expect(screen.getByTestId('rescue-results')).toBeInTheDocument();
  });

  it('rescue meal can be added to tonight from fixture', async () => {
    loadFixture();
    const user = userEvent.setup();
    renderRoute('/household/H002/rescue');

    await user.click(screen.getByTestId('scenario-low-time'));

    const addButtons = screen.getAllByText('Add to tonight');
    await user.click(addButtons[0]!);

    const saved = loadHousehold('H002')!;
    expect(saved.weeklyPlans.length).toBeGreaterThan(0);
    const plan = saved.weeklyPlans[saved.weeklyPlans.length - 1]!;
    const tonight = plan.days.find((d) => d.day === 'Tonight');
    expect(tonight).toBeDefined();
    expect(tonight!.variants.length).toBe(4);
  });

  it('rescue mode is reachable from Home in one tap', () => {
    loadFixture();
    renderRoute('/household/H002/home');

    const rescueCard = screen.getByTestId('rescue-mode-card');
    expect(rescueCard).toBeInTheDocument();
    expect(rescueCard.getAttribute('href')).toBe('/household/H002/rescue');
  });
});

describe('E2E: Grocery list generation flow', () => {
  it('generates a merged grocery list from a fixture weekly plan', () => {
    const h = loadFixture();
    const plan = generateWeeklyPlan(h.baseMeals, h.members, h.ingredients, 7);
    const groceryList = generateGroceryList(plan, h.baseMeals, h.ingredients);

    expect(groceryList.length).toBeGreaterThan(0);
    for (const item of groceryList) {
      expect(item.name).toBeTruthy();
      expect(item.category).toBeTruthy();
    }
  });

  it('repeated ingredients are consolidated across the week', () => {
    const h = loadFixture();
    const plan = generateWeeklyPlan(h.baseMeals, h.members, h.ingredients, 7);
    const groceryList = generateGroceryList(plan, h.baseMeals, h.ingredients);

    const ingredientNames = groceryList.map((i) => i.name);
    const uniqueNames = new Set(ingredientNames);
    expect(uniqueNames.size).toBe(ingredientNames.length);
    const consolidated = groceryList.filter((i) => i.quantity !== '');
    expect(consolidated.length).toBeGreaterThan(0);
  });

  it('grocery list tracks meal linkbacks', () => {
    const h = loadFixture();
    const plan = generateWeeklyPlan(h.baseMeals, h.members, h.ingredients, 5);
    const groceryList = generateGroceryList(plan, h.baseMeals, h.ingredients);

    for (const item of groceryList) {
      expect(item.usedInMeals.length).toBeGreaterThan(0);
    }
  });

  it('grocery list page renders from saved plan', () => {
    const h = loadFixture();
    const plan = generateWeeklyPlan(h.baseMeals, h.members, h.ingredients, 7);
    h.weeklyPlans = [
      {
        id: 'plan-e2e',
        days: plan,
        selectedBaseMeals: [...new Set(plan.map((d) => d.baseMealId))],
        generatedGroceryList: [],
        notes: '',
      },
    ];
    saveHousehold(h);

    renderRoute('/household/H002/grocery');

    expect(screen.getByTestId('grocery-categories')).toBeInTheDocument();
  });

  it('already-have toggle works on fixture grocery list', async () => {
    const h = loadFixture();
    const plan = generateWeeklyPlan(h.baseMeals, h.members, h.ingredients, 7);
    h.weeklyPlans = [
      {
        id: 'plan-e2e',
        days: plan,
        selectedBaseMeals: [...new Set(plan.map((d) => d.baseMealId))],
        generatedGroceryList: [],
        notes: '',
      },
    ];
    saveHousehold(h);

    const user = userEvent.setup();
    renderRoute('/household/H002/grocery');

    const summary = screen.getByTestId('grocery-summary');
    const initialText = summary.textContent!;
    expect(initialText).toContain('to buy');

    const toggleButtons = screen.getAllByTestId(/^toggle-owned-/);
    await user.click(toggleButtons[0]!);

    expect(summary.textContent).toContain('already have');
  });
});

describe('E2E: Cross-flow fixture consistency', () => {
  it('fixture ingredients match fixture meal component references', () => {
    const h = loadFixture();
    for (const meal of h.baseMeals) {
      for (const component of meal.components) {
        const ing = h.ingredients.find((i) => i.id === component.ingredientId);
        expect(ing).toBeDefined();
      }
    }
  });

  it('fixture members have overlapping but conflicting preferences', () => {
    const h = loadFixture();
    const alex = h.members.find((m) => m.id === 'M001')!;
    const jordan = h.members.find((m) => m.id === 'M002')!;
    expect(alex.hardNoFoods.some((f) => jordan.safeFoods.includes(f))).toBe(true);

    const riley = h.members.find((m) => m.id === 'M003')!;
    const sam = h.members.find((m) => m.id === 'M004')!;
    expect(riley.textureLevel).toBe('soft');
    expect(sam.textureLevel).toBe('mashable');
  });

  it('full planning pipeline: fixture to plan to variants to grocery to rescue', () => {
    const h = loadFixture();

    const plan = generateWeeklyPlan(h.baseMeals, h.members, h.ingredients, 5);
    expect(plan.length).toBe(5);

    for (const day of plan) {
      expect(day.variants.length).toBe(h.members.length);
    }

    const groceryList = generateGroceryList(plan, h.baseMeals, h.ingredients);
    expect(groceryList.length).toBeGreaterThan(0);

    const rescueMeals = generateRescueMeals(h.baseMeals, h.members, h.ingredients, 'low-energy');
    expect(rescueMeals.length).toBeGreaterThan(0);
    for (const rescue of rescueMeals) {
      expect(rescue.variants.length).toBe(h.members.length);
      expect(rescue.prepSummary).toBeTruthy();
      expect(rescue.confidence).toBeTruthy();
    }
  });
});
