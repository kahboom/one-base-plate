import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import type { Household } from '../src/types';
import { saveHousehold } from '../src/storage';
import HouseholdSetup from '../src/pages/HouseholdSetup';
import { householdLayoutRouteBranch } from './householdLayoutRoutes';

function seedHousehold(): Household {
  const household: Household = {
    id: 'h-nav',
    name: 'Nav Test Family',
    members: [
      {
        id: 'm1',
        name: 'Alice',
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
        id: 'i1',
        name: 'Chicken',
        category: 'protein',
        tags: [],
        shelfLifeHint: '',
        babySafeWithAdaptation: true,
        freezerFriendly: false,
      },
    ],
    baseMeals: [
      {
        id: 'meal1',
        name: 'Test Meal',
        components: [{ ingredientId: 'i1', role: 'protein', quantity: '200g' }],
        defaultPrep: 'pan-fry',
        estimatedTimeMinutes: 15,
        difficulty: 'easy',
        rescueEligible: true,
        wasteReuseHints: [],
      },
    ],
    weeklyPlans: [],
    pinnedMealIds: [],
  };
  saveHousehold(household);
  return household;
}

const GLOBAL_NAV_LINKS = [
  'Home',
  'Weekly planner',
  'Meal planner',
  'Grocery list',
  'Rescue mode',
  'Meal history',
];
const SECTION_LINKS = ['All households', 'Ingredients', 'Base meals', 'Settings'];

function renderRoute(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/household/new" element={<HouseholdSetup />} />
        {householdLayoutRouteBranch}
        <Route path="/households" element={<div>All Households Page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe('F036: Consistent navigation across all household screens', () => {
  describe('Global nav appears with consistent links on all pages', () => {
    it('Home page has all global nav links', () => {
      seedHousehold();
      renderRoute('/household/h-nav/home');
      const nav = screen.getByRole('navigation', { name: 'Global navigation' });
      for (const label of GLOBAL_NAV_LINKS) {
        expect(within(nav).getByText(label)).toBeInTheDocument();
      }
    });

    it('Planner page has all global nav links', () => {
      seedHousehold();
      renderRoute('/household/h-nav/planner');
      const nav = screen.getByRole('navigation', { name: 'Global navigation' });
      for (const label of GLOBAL_NAV_LINKS) {
        expect(within(nav).getByText(label)).toBeInTheDocument();
      }
    });

    it('Weekly planner page has all global nav links', () => {
      seedHousehold();
      renderRoute('/household/h-nav/weekly');
      const nav = screen.getByRole('navigation', { name: 'Global navigation' });
      for (const label of GLOBAL_NAV_LINKS) {
        expect(within(nav).getByText(label)).toBeInTheDocument();
      }
    });

    it('Grocery list page has all global nav links', () => {
      seedHousehold();
      renderRoute('/household/h-nav/grocery');
      const nav = screen.getByRole('navigation', { name: 'Global navigation' });
      for (const label of GLOBAL_NAV_LINKS) {
        expect(within(nav).getByText(label)).toBeInTheDocument();
      }
    });

    it('Rescue mode page has all global nav links', () => {
      seedHousehold();
      renderRoute('/household/h-nav/rescue');
      const nav = screen.getByRole('navigation', { name: 'Global navigation' });
      for (const label of GLOBAL_NAV_LINKS) {
        expect(within(nav).getByText(label)).toBeInTheDocument();
      }
    });

    it('Meal detail page has all global nav links', () => {
      seedHousehold();
      renderRoute('/household/h-nav/meal/meal1');
      const nav = screen.getByRole('navigation', { name: 'Global navigation' });
      for (const label of GLOBAL_NAV_LINKS) {
        expect(within(nav).getByText(label)).toBeInTheDocument();
      }
    });

    it('Ingredient manager page has all global nav links', () => {
      seedHousehold();
      renderRoute('/household/h-nav/ingredients');
      const nav = screen.getByRole('navigation', { name: 'Global navigation' });
      for (const label of GLOBAL_NAV_LINKS) {
        expect(within(nav).getByText(label)).toBeInTheDocument();
      }
    });

    it('Base meal manager page has all global nav links', () => {
      seedHousehold();
      renderRoute('/household/h-nav/meals');
      const nav = screen.getByRole('navigation', { name: 'Global navigation' });
      for (const label of GLOBAL_NAV_LINKS) {
        expect(within(nav).getByText(label)).toBeInTheDocument();
      }
    });

    it('Settings page has all global nav links', () => {
      seedHousehold();
      renderRoute('/household/h-nav/settings');
      const nav = screen.getByRole('navigation', { name: 'Global navigation' });
      for (const label of GLOBAL_NAV_LINKS) {
        expect(within(nav).getByText(label)).toBeInTheDocument();
      }
    });

    it('Meal history page has all global nav links', () => {
      seedHousehold();
      renderRoute('/household/h-nav/history');
      const nav = screen.getByRole('navigation', { name: 'Global navigation' });
      for (const label of GLOBAL_NAV_LINKS) {
        expect(within(nav).getByText(label)).toBeInTheDocument();
      }
    });

    it('Household setup page has all global nav links for saved household', () => {
      seedHousehold();
      renderRoute('/household/h-nav');
      const nav = screen.getByRole('navigation', { name: 'Global navigation' });
      for (const label of GLOBAL_NAV_LINKS) {
        expect(within(nav).getByText(label)).toBeInTheDocument();
      }
    });
  });

  describe('Secondary nav appears on household shell screens (F053)', () => {
    function expectSecondaryNavLabels() {
      const sectionNav = screen.getByTestId('section-nav');
      for (const label of SECTION_LINKS) {
        expect(within(sectionNav).getByText(label)).toBeInTheDocument();
      }
    }

    it.each([
      '/household/h-nav/home',
      '/household/h-nav/weekly',
      '/household/h-nav/planner',
      '/household/h-nav/grocery',
      '/household/h-nav/rescue',
      '/household/h-nav/ingredients',
      '/household/h-nav/meals',
      '/household/h-nav/meal/meal1',
      '/household/h-nav/settings',
      '/household/h-nav',
    ])('secondary nav on %s', (path) => {
      seedHousehold();
      renderRoute(path);
      expectSecondaryNavLabels();
    });

    it('Ingredient manager marks Ingredients as active in secondary nav', () => {
      seedHousehold();
      renderRoute('/household/h-nav/ingredients');
      const ingredientsLink = within(screen.getByTestId('section-nav')).getByText('Ingredients');
      expect(ingredientsLink).toHaveAttribute('aria-current', 'page');
    });

    it('Base meal manager marks Base meals as active in secondary nav', () => {
      seedHousehold();
      renderRoute('/household/h-nav/meals');
      const link = within(screen.getByTestId('section-nav')).getByText('Base meals');
      expect(link).toHaveAttribute('aria-current', 'page');
    });

    it('Meal detail marks Base meals as active in secondary nav', () => {
      seedHousehold();
      renderRoute('/household/h-nav/meal/meal1');
      const link = within(screen.getByTestId('section-nav')).getByText('Base meals');
      expect(link).toHaveAttribute('aria-current', 'page');
    });

    it('Settings marks Settings as active in secondary nav', () => {
      seedHousehold();
      renderRoute('/household/h-nav/settings');
      const link = within(screen.getByTestId('section-nav')).getByText('Settings');
      expect(link).toHaveAttribute('aria-current', 'page');
    });

    it('Meal detail does not mark Meal planner active in global nav', () => {
      seedHousehold();
      renderRoute('/household/h-nav/meal/meal1');
      const nav = screen.getByRole('navigation', { name: 'Global navigation' });
      const plannerLink = within(nav).getByText('Meal planner');
      expect(plannerLink).not.toHaveAttribute('aria-current', 'page');
    });

    it('global nav never shows Household setup', () => {
      seedHousehold();
      renderRoute('/household/h-nav/home');
      const nav = screen.getByRole('navigation', { name: 'Global navigation' });
      expect(within(nav).queryByText('Household setup')).not.toBeInTheDocument();
    });
  });

  describe("No 'Back to household' buttons remain", () => {
    it('Planner does not have Back to household button', () => {
      seedHousehold();
      renderRoute('/household/h-nav/planner');
      expect(screen.queryByText(/back to household/i)).not.toBeInTheDocument();
    });

    it('Weekly planner does not have Back to household button', () => {
      seedHousehold();
      renderRoute('/household/h-nav/weekly');
      expect(screen.queryByText(/back to household/i)).not.toBeInTheDocument();
    });
  });

  describe('Home is the canonical hub — nav links route to /home', () => {
    it('Home link in nav points to /household/:id/home', () => {
      seedHousehold();
      renderRoute('/household/h-nav/weekly');
      const nav = screen.getByRole('navigation', { name: 'Global navigation' });
      const homeLink = within(nav).getByText('Home');
      expect(homeLink.closest('a')).toHaveAttribute('href', '/household/h-nav/home');
    });

    it('nav links use consistent hrefs', () => {
      seedHousehold();
      renderRoute('/household/h-nav/planner');
      const nav = screen.getByRole('navigation', { name: 'Global navigation' });
      const links = nav.querySelectorAll('a');
      const hrefs = Array.from(links).map((a) => a.getAttribute('href'));
      expect(hrefs).toContain('/household/h-nav/home');
      expect(hrefs).toContain('/household/h-nav/weekly');
      expect(hrefs).toContain('/household/h-nav/planner');
      expect(hrefs).toContain('/household/h-nav/grocery');
      expect(hrefs).toContain('/household/h-nav/rescue');
      expect(hrefs).toContain('/household/h-nav/history');
      expect(hrefs).not.toContain('/households');
    });
  });

  describe('Navigation from child screens returns to Home', () => {
    it('Weekly planner Home link navigates to Home page', async () => {
      seedHousehold();
      const user = userEvent.setup();
      renderRoute('/household/h-nav/weekly');
      const nav = screen.getByRole('navigation', { name: 'Global navigation' });
      await user.click(within(nav).getByText('Home'));
      expect(screen.getByText('What should we eat tonight?')).toBeInTheDocument();
    });

    it('Meal planner Home link navigates to Home page', async () => {
      seedHousehold();
      const user = userEvent.setup();
      renderRoute('/household/h-nav/planner');
      const nav = screen.getByRole('navigation', { name: 'Global navigation' });
      await user.click(within(nav).getByText('Home'));
      expect(screen.getByText('What should we eat tonight?')).toBeInTheDocument();
    });

    it('Grocery list Home link navigates to Home page', async () => {
      seedHousehold();
      const user = userEvent.setup();
      renderRoute('/household/h-nav/grocery');
      const nav = screen.getByRole('navigation', { name: 'Global navigation' });
      await user.click(within(nav).getByText('Home'));
      expect(screen.getByText('What should we eat tonight?')).toBeInTheDocument();
    });

    it('Rescue mode Home link navigates to Home page', async () => {
      seedHousehold();
      const user = userEvent.setup();
      renderRoute('/household/h-nav/rescue');
      const nav = screen.getByRole('navigation', { name: 'Global navigation' });
      await user.click(within(nav).getByText('Home'));
      expect(screen.getByText('What should we eat tonight?')).toBeInTheDocument();
    });
  });

  describe('MemberProfile default return goes to Home', () => {
    it('header brand link navigates to Home', async () => {
      seedHousehold();
      const user = userEvent.setup();
      renderRoute('/household/h-nav/member/m1');
      await user.click(screen.getByText('OneBasePlate'));
      expect(screen.getByText('What should we eat tonight?')).toBeInTheDocument();
    });
  });

  describe('Consistent nav link order', () => {
    it('links appear in the same order on all pages', () => {
      seedHousehold();
      renderRoute('/household/h-nav/home');
      const homeNav = screen.getByRole('navigation', { name: 'Global navigation' });
      const homeOrder = Array.from(homeNav.querySelectorAll('a')).map((a) => a.textContent);

      cleanup();
      seedHousehold();
      renderRoute('/household/h-nav/planner');
      const plannerNav = screen.getByRole('navigation', { name: 'Global navigation' });
      const plannerOrder = Array.from(plannerNav.querySelectorAll('a')).map((a) => a.textContent);

      expect(homeOrder).toEqual(plannerOrder);
    });
  });

  describe('Nav uses shared styling system', () => {
    it('nav is rendered as a nav element with pill-bar styling', () => {
      seedHousehold();
      renderRoute('/household/h-nav/home');
      const nav = screen.getByRole('navigation', { name: 'Global navigation' });
      expect(nav.className).toContain('border');
      expect(nav.className).toContain('flex-wrap');
      expect(nav.className).toMatch(/rounded-t-(?:md|lg)|rounded-md|rounded-lg/);
    });

    it('inactive nav links use pill styling with hover state', () => {
      seedHousehold();
      renderRoute('/household/h-nav/home');
      const nav = screen.getByRole('navigation', { name: 'Global navigation' });
      const link = within(nav).getByText('Weekly planner');
      expect(link.className).toContain('rounded-pill');
      expect(link.className).toContain('hover:bg-brand-light');
    });

    it('active nav link has brand background and white text', () => {
      seedHousehold();
      renderRoute('/household/h-nav/home');
      const nav = screen.getByRole('navigation', { name: 'Global navigation' });
      const homeLink = within(nav).getByText('Home');
      expect(homeLink.className).toContain('bg-brand');
      expect(homeLink.className).toContain('text-white');
    });

    it('active nav link has aria-current=page', () => {
      seedHousehold();
      renderRoute('/household/h-nav/home');
      const nav = screen.getByRole('navigation', { name: 'Global navigation' });
      const homeLink = within(nav).getByText('Home');
      expect(homeLink).toHaveAttribute('aria-current', 'page');
    });

    it('inactive nav link does not have aria-current', () => {
      seedHousehold();
      renderRoute('/household/h-nav/home');
      const nav = screen.getByRole('navigation', { name: 'Global navigation' });
      const weeklyLink = within(nav).getByText('Weekly planner');
      expect(weeklyLink).not.toHaveAttribute('aria-current');
    });

    it('nav links have touch-friendly min-height for mobile', () => {
      seedHousehold();
      renderRoute('/household/h-nav/home');
      const nav = screen.getByRole('navigation', { name: 'Global navigation' });
      const link = within(nav).getByText('Meal planner');
      expect(link.className).toContain('min-h-[36px]');
    });

    it('active state changes when navigating to a different page', async () => {
      seedHousehold();
      const user = userEvent.setup();
      renderRoute('/household/h-nav/home');
      let nav = screen.getByRole('navigation', { name: 'Global navigation' });
      expect(within(nav).getByText('Home')).toHaveAttribute('aria-current', 'page');
      expect(within(nav).getByText('Weekly planner')).not.toHaveAttribute('aria-current');

      await user.click(within(nav).getByText('Weekly planner'));
      nav = screen.getByRole('navigation', { name: 'Global navigation' });
      expect(within(nav).getByText('Weekly planner')).toHaveAttribute('aria-current', 'page');
      expect(within(nav).getByText('Home')).not.toHaveAttribute('aria-current');
    });
  });
});
