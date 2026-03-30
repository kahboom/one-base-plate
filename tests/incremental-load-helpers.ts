import { screen, fireEvent } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';

/** F070: Add ingredient opens catalog search; use this to open the manual-ingredient modal (name empty unless search was typed). */
export async function openIngredientAddManualFromCatalogPicker(user: UserEvent) {
  await user.click(screen.getAllByText('Add ingredient')[0]!);
  await user.click(screen.getByTestId('catalog-add-create-manual'));
}

/** F070: Search master catalog in add dialog and pick one row (by data-testid on the result button). */
export async function pickCatalogItemInAddDialog(
  user: UserEvent,
  searchQuery: string,
  resultTestId: string,
) {
  await user.click(screen.getAllByText('Add ingredient')[0]!);
  await user.type(screen.getByTestId('catalog-add-search'), searchQuery);
  await user.click(screen.getByTestId(resultTestId));
}

/**
 * Legacy helper: clicks "Load more" until gone (infinite scroll).
 * With pagination, this is a no-op since the button no longer exists.
 * @deprecated Use {@link showAllIngredientRows} for paginated lists.
 */
export function loadAllIngredientListRows(maxClicks = 100) {
  for (let i = 0; i < maxClicks; i++) {
    const btn = screen.queryByTestId('ingredient-list-load-more');
    if (!btn) break;
    fireEvent.click(btn);
  }
}

/**
 * Set page size to 100 to show as many rows as possible on one page.
 * For lists > 100, navigate additional pages.
 */
export function showAllIngredientRows() {
  const pageSizeSelect = screen.queryByTestId('ingredient-page-size');
  if (pageSizeSelect) {
    fireEvent.change(pageSizeSelect, { target: { value: '100' } });
  }
}

/**
 * Returns true if the given text is found on any page of the ingredient list.
 * Navigates through all pages, then returns to the first page.
 */
export function ingredientTextExistsOnAnyPage(text: string): boolean {
  showAllIngredientRows();
  if (screen.queryByText(text)) return true;
  const nextBtn = screen.queryByTestId('pagination-next');
  if (!nextBtn) return false;
  let found = false;
  for (let i = 0; i < 20; i++) {
    if ((nextBtn as HTMLButtonElement).disabled) break;
    fireEvent.click(nextBtn);
    if (screen.queryByText(text)) {
      found = true;
      break;
    }
  }
  const firstBtn = screen.queryByTestId('pagination-first');
  if (firstBtn) fireEvent.click(firstBtn);
  return found;
}
