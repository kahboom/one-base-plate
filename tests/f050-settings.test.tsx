import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import type { Household } from '../src/types';
import {
  loadHouseholds,
  saveHousehold,
  loadDefaultHouseholdId,
  saveDefaultHouseholdId,
} from '../src/storage';
import seedData from '../src/seed-data.json';
import { saveImportSession, loadImportSession } from '../src/paprika-parser';
import { applyThemeToDocument, loadThemePreference } from '../src/theme';
import { householdLayoutRouteBranch } from './householdLayoutRoutes';

function makeHousehold(overrides: Partial<Household> = {}): Household {
  return {
    id: 'h-settings',
    name: 'Settings Test',
    members: [],
    ingredients: [],
    baseMeals: [],
    weeklyPlans: [],
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
  applyThemeToDocument(loadThemePreference());
});

function renderSettings(initialPath = '/household/h-settings/settings') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        {householdLayoutRouteBranch}
        <Route path="/households" element={<div data-testid="households-page">Households</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('F050 — Settings page', () => {
  it('shows data actions and Paprika import', () => {
    saveHousehold(makeHousehold());
    renderSettings();

    expect(screen.getByTestId('settings-export-btn')).toBeInTheDocument();
    expect(screen.getByTestId('settings-import-btn')).toBeInTheDocument();
    expect(screen.getByTestId('settings-reset-default-btn')).toBeInTheDocument();
    expect(screen.getByTestId('settings-clear-all-btn')).toBeInTheDocument();
    expect(screen.getByTestId('import-paprika-btn')).toBeInTheDocument();
  });

  it('clears households, default household id, and Paprika session after confirm', async () => {
    saveHousehold(makeHousehold());
    saveDefaultHouseholdId('h-settings');
    saveImportSession({
      householdId: 'h-settings',
      parsedRecipes: [],
      step: 'upload',
      savedAt: new Date().toISOString(),
    });

    renderSettings();

    await userEvent.click(screen.getByTestId('settings-clear-all-btn'));
    await userEvent.click(screen.getByRole('button', { name: 'Clear all' }));

    expect(loadHouseholds()).toEqual([]);
    expect(loadDefaultHouseholdId()).toBeNull();
    expect(loadImportSession('h-settings')).toBeNull();
    expect(screen.getByTestId('households-page')).toBeInTheDocument();
  });

  it('resets to bundled seed data, default id, clears Paprika session, and navigates after confirm', async () => {
    saveHousehold(makeHousehold({ id: 'custom-h', name: 'Custom' }));
    saveDefaultHouseholdId('custom-h');
    saveImportSession({
      householdId: 'custom-h',
      parsedRecipes: [],
      step: 'upload',
      savedAt: new Date().toISOString(),
    });

    renderSettings('/household/custom-h/settings');

    await userEvent.click(screen.getByTestId('settings-reset-default-btn'));
    await userEvent.click(screen.getByRole('button', { name: 'Reset to defaults' }));

    await waitFor(() => {
      expect(screen.getByTestId('households-page')).toBeInTheDocument();
    });

    const seeded = seedData as unknown as Household[];
    expect(loadHouseholds()).toHaveLength(seeded.length);
    expect(loadHouseholds()[0]!.id).toBe(seeded[0]!.id);
    expect(loadDefaultHouseholdId()).toBe(seeded[0]!.id);
    expect(loadImportSession('custom-h')).toBeNull();
  });
});
