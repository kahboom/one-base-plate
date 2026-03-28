import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes } from 'react-router-dom';
import type { Household } from '../src/types';
import { saveHousehold, loadHousehold } from '../src/storage';
import { householdLayoutRouteBranch } from './householdLayoutRoutes';

function makeHousehold(overrides: Partial<Household> = {}): Household {
  return {
    id: 'h-theme',
    name: 'Theme Test',
    members: [],
    ingredients: [],
    baseMeals: [],
    weeklyPlans: [],
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
});

function renderWeeklyPlanner() {
  return render(
    <MemoryRouter initialEntries={['/household/h-theme/weekly']}>
      <Routes>{householdLayoutRouteBranch}</Routes>
    </MemoryRouter>,
  );
}

describe('F056: Weekly theme anchors', () => {
  it('persists a weekly anchor from Weekly Planner', async () => {
    saveHousehold(makeHousehold());
    const user = userEvent.setup();
    renderWeeklyPlanner();

    await user.click(screen.getByTestId('weekly-theme-nights-toggle'));
    await user.type(screen.getByTestId('anchor-label'), 'Taco night');
    await user.type(screen.getByTestId('anchor-tags'), 'taco');
    await user.click(screen.getByTestId('anchor-add-btn'));

    expect(screen.getByTestId('weekly-anchors-list')).toHaveTextContent('Taco night');

    const h = loadHousehold('h-theme')!;
    expect(h.weeklyAnchors?.length).toBe(1);
    expect(h.weeklyAnchors![0]!.label).toBe('Taco night');
    expect(h.weeklyAnchors![0]!.matchTags).toContain('taco');
  });

  it('persists structure types from the multi-select', async () => {
    saveHousehold(makeHousehold());
    const user = userEvent.setup();
    renderWeeklyPlanner();

    await user.click(screen.getByTestId('weekly-theme-nights-toggle'));
    await user.type(screen.getByTestId('anchor-label'), 'Protein night');
    await user.click(screen.getByTestId('anchor-structure'));
    await user.click(screen.getByTestId('anchor-structure-multi-protein'));
    await user.click(screen.getByTestId('anchor-add-btn'));

    const h = loadHousehold('h-theme')!;
    expect(h.weeklyAnchors?.[0]!.matchStructureTypes).toEqual(['multi-protein']);
  });
});
