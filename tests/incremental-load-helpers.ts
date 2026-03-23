import { screen, fireEvent } from "@testing-library/react";

/**
 * Legacy helper: clicks "Load more" until gone (infinite scroll).
 * With pagination, this is a no-op since the button no longer exists.
 * @deprecated Use {@link showAllIngredientRows} for paginated lists.
 */
export function loadAllIngredientListRows(maxClicks = 100) {
  for (let i = 0; i < maxClicks; i++) {
    const btn = screen.queryByTestId("ingredient-list-load-more");
    if (!btn) break;
    fireEvent.click(btn);
  }
}

/**
 * Set page size to 100 to show as many rows as possible on one page.
 * For lists > 100, navigate additional pages.
 */
export function showAllIngredientRows() {
  const pageSizeSelect = screen.queryByTestId("ingredient-page-size");
  if (pageSizeSelect) {
    fireEvent.change(pageSizeSelect, { target: { value: "100" } });
  }
}
