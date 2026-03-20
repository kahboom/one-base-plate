import { screen, fireEvent } from "@testing-library/react";

/** Expands incrementally loaded ingredient rows (sync tests). */
export function loadAllIngredientListRows(maxClicks = 100) {
  for (let i = 0; i < maxClicks; i++) {
    const btn = screen.queryByTestId("ingredient-list-load-more");
    if (!btn) break;
    fireEvent.click(btn);
  }
}
