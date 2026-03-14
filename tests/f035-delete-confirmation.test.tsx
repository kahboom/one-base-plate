import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import type { Household } from "../src/types";
import { saveHousehold, loadHouseholds, saveHouseholds } from "../src/storage";
import { MASTER_CATALOG } from "../src/catalog";
import HouseholdList from "../src/pages/HouseholdList";
import HouseholdSetup from "../src/pages/HouseholdSetup";
import IngredientManager from "../src/pages/IngredientManager";
import BaseMealManager from "../src/pages/BaseMealManager";

function makeHousehold(overrides: Partial<Household> = {}): Household {
  return {
    id: "h1",
    name: "Test Family",
    members: [
      {
        id: "m1",
        name: "Alice",
        role: "adult",
        safeFoods: [],
        hardNoFoods: [],
        preparationRules: [],
        textureLevel: "regular",
        allergens: [],
        notes: "",
      },
      {
        id: "m2",
        name: "Bob",
        role: "toddler",
        safeFoods: ["pasta"],
        hardNoFoods: [],
        preparationRules: [],
        textureLevel: "soft",
        allergens: [],
        notes: "",
      },
    ],
    ingredients: [
      {
        id: "i1",
        name: "Chicken",
        category: "protein",
        tags: [],
        shelfLifeHint: "",
        freezerFriendly: false,
        babySafeWithAdaptation: false,
      },
      {
        id: "i2",
        name: "Rice",
        category: "carb",
        tags: [],
        shelfLifeHint: "",
        freezerFriendly: false,
        babySafeWithAdaptation: false,
      },
    ],
    baseMeals: [
      {
        id: "meal1",
        name: "Chicken Rice",
        components: [
          { ingredientId: "i1", role: "protein", quantity: "200g" },
          { ingredientId: "i2", role: "carb", quantity: "150g" },
        ],
        defaultPrep: "stir-fry",
        estimatedTimeMinutes: 25,
        difficulty: "easy",
        rescueEligible: false,
        wasteReuseHints: [],
        recipeLinks: [],
        notes: "",
      },
    ],
    weeklyPlans: [],
    pinnedMealIds: [],
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
});

describe("F035: Delete household confirmation", () => {
  it("shows confirmation dialog when Delete is clicked", async () => {
    const user = userEvent.setup();
    saveHousehold(makeHousehold());

    render(
      <MemoryRouter initialEntries={["/"]}>
        <HouseholdList />
      </MemoryRouter>
    );

    await user.click(screen.getByText("Delete"));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("aria-label", "Delete household");
  });

  it("surfaces the household name in the warning", async () => {
    const user = userEvent.setup();
    saveHousehold(makeHousehold());

    render(
      <MemoryRouter initialEntries={["/"]}>
        <HouseholdList />
      </MemoryRouter>
    );

    await user.click(screen.getByText("Delete"));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/Test Family/)).toBeInTheDocument();
    expect(within(dialog).getByText(/cannot be undone/)).toBeInTheDocument();
  });

  it("deletes household only after confirming", async () => {
    const user = userEvent.setup();
    saveHousehold(makeHousehold());

    render(
      <MemoryRouter initialEntries={["/"]}>
        <HouseholdList />
      </MemoryRouter>
    );

    await user.click(screen.getByText("Delete"));
    // Household still exists before confirmation
    expect(loadHouseholds()).toHaveLength(1);

    // Click the confirm Delete button inside dialog
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByText("Delete"));

    expect(loadHouseholds()).toHaveLength(0);
  });

  it("cancels deletion and keeps household", async () => {
    const user = userEvent.setup();
    saveHousehold(makeHousehold());

    render(
      <MemoryRouter initialEntries={["/"]}>
        <HouseholdList />
      </MemoryRouter>
    );

    await user.click(screen.getByText("Delete"));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByText("Cancel"));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(loadHouseholds()).toHaveLength(1);
    expect(screen.getByText("Test Family")).toBeInTheDocument();
  });
});

describe("F035: Remove member confirmation", () => {
  it("shows confirmation dialog with member name", async () => {
    const user = userEvent.setup();
    saveHousehold(makeHousehold());

    render(
      <MemoryRouter initialEntries={["/household/h1"]}>
        <Routes>
          <Route path="/household/:id" element={<HouseholdSetup />} />
        </Routes>
      </MemoryRouter>
    );

    const removeBtns = screen.getAllByText("Remove member");
    await user.click(removeBtns[0]);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText(/Alice/)).toBeInTheDocument();
  });

  it("removes member only after confirming", async () => {
    const user = userEvent.setup();
    saveHousehold(makeHousehold());

    render(
      <MemoryRouter initialEntries={["/household/h1"]}>
        <Routes>
          <Route path="/household/:id" element={<HouseholdSetup />} />
        </Routes>
      </MemoryRouter>
    );

    const removeBtns = screen.getAllByText("Remove member");
    await user.click(removeBtns[0]);

    // Member still visible before confirmation
    expect(screen.getByDisplayValue("Alice")).toBeInTheDocument();

    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByText("Remove"));

    expect(screen.queryByDisplayValue("Alice")).not.toBeInTheDocument();
    expect(screen.getByDisplayValue("Bob")).toBeInTheDocument();
  });

  it("cancels member removal and keeps member", async () => {
    const user = userEvent.setup();
    saveHousehold(makeHousehold());

    render(
      <MemoryRouter initialEntries={["/household/h1"]}>
        <Routes>
          <Route path="/household/:id" element={<HouseholdSetup />} />
        </Routes>
      </MemoryRouter>
    );

    const removeBtns = screen.getAllByText("Remove member");
    await user.click(removeBtns[0]);

    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByText("Cancel"));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByDisplayValue("Alice")).toBeInTheDocument();
  });
});

describe("F035: Remove ingredient confirmation", () => {
  it("shows confirmation dialog with ingredient name", async () => {
    const user = userEvent.setup();
    saveHousehold(makeHousehold());

    render(
      <MemoryRouter initialEntries={["/household/h1/ingredients"]}>
        <Routes>
          <Route path="/household/:householdId/ingredients" element={<IngredientManager />} />
        </Routes>
      </MemoryRouter>
    );

    // Click row to open modal, then click Remove inside modal
    const rows = screen.getAllByTestId(/^ingredient-row-/);
    await user.click(rows[0]!);
    const modal = screen.getByTestId("ingredient-modal");
    await user.click(within(modal).getByText("Remove ingredient"));

    const dialog = screen.getByRole("dialog", { name: "Remove ingredient" });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText(/Chicken/)).toBeInTheDocument();
  });

  it("removes ingredient only after confirming", async () => {
    const user = userEvent.setup();
    saveHousehold(makeHousehold());

    render(
      <MemoryRouter initialEntries={["/household/h1/ingredients"]}>
        <Routes>
          <Route path="/household/:householdId/ingredients" element={<IngredientManager />} />
        </Routes>
      </MemoryRouter>
    );

    // Open modal and click Remove
    const rows = screen.getAllByTestId(/^ingredient-row-/);
    await user.click(rows[0]!);
    const modal = screen.getByTestId("ingredient-modal");
    await user.click(within(modal).getByText("Remove ingredient"));

    const dialog = screen.getByRole("dialog", { name: "Remove ingredient" });
    await user.click(within(dialog).getByText("Remove"));

    // After removal, one fewer row
    const remainingRows = screen.getAllByTestId(/^ingredient-row-/);
    const catalogOverlap = MASTER_CATALOG.filter((ci) => ci.name.toLowerCase() === "rice").length;
    const expectedAfterRemove = 1 + MASTER_CATALOG.length - catalogOverlap;
    expect(remainingRows).toHaveLength(expectedAfterRemove);
    expect(screen.getByText("Rice")).toBeInTheDocument();
  });

  it("cancels ingredient removal", async () => {
    const user = userEvent.setup();
    saveHousehold(makeHousehold());

    render(
      <MemoryRouter initialEntries={["/household/h1/ingredients"]}>
        <Routes>
          <Route path="/household/:householdId/ingredients" element={<IngredientManager />} />
        </Routes>
      </MemoryRouter>
    );

    // Open modal and click Remove
    const rows = screen.getAllByTestId(/^ingredient-row-/);
    await user.click(rows[0]!);
    const modal = screen.getByTestId("ingredient-modal");
    await user.click(within(modal).getByText("Remove ingredient"));

    const dialog = screen.getByRole("dialog", { name: "Remove ingredient" });
    await user.click(within(dialog).getByText("Cancel"));

    expect(screen.queryByRole("dialog", { name: "Remove ingredient" })).not.toBeInTheDocument();
    // All ingredient rows should still exist (household + catalog)
    const catalogOverlap = MASTER_CATALOG.filter((ci) => ["chicken", "rice"].includes(ci.name.toLowerCase())).length;
    const expectedCount = 2 + MASTER_CATALOG.length - catalogOverlap;
    expect(screen.getAllByTestId(/^ingredient-row-/)).toHaveLength(expectedCount);
  });
});

describe("F035: Remove meal confirmation", () => {
  it("shows confirmation dialog with meal name", async () => {
    const user = userEvent.setup();
    saveHousehold(makeHousehold());

    render(
      <MemoryRouter initialEntries={["/household/h1/meals"]}>
        <Routes>
          <Route path="/household/:householdId/meals" element={<BaseMealManager />} />
        </Routes>
      </MemoryRouter>
    );

    await user.click(screen.getByText("Remove meal"));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText(/Chicken Rice/)).toBeInTheDocument();
  });

  it("removes meal only after confirming", async () => {
    const user = userEvent.setup();
    saveHousehold(makeHousehold());

    render(
      <MemoryRouter initialEntries={["/household/h1/meals"]}>
        <Routes>
          <Route path="/household/:householdId/meals" element={<BaseMealManager />} />
        </Routes>
      </MemoryRouter>
    );

    await user.click(screen.getByText("Remove meal"));
    expect(screen.getByDisplayValue("Chicken Rice")).toBeInTheDocument();

    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByText("Remove"));

    expect(screen.queryByDisplayValue("Chicken Rice")).not.toBeInTheDocument();
  });

  it("cancels meal removal", async () => {
    const user = userEvent.setup();
    saveHousehold(makeHousehold());

    render(
      <MemoryRouter initialEntries={["/household/h1/meals"]}>
        <Routes>
          <Route path="/household/:householdId/meals" element={<BaseMealManager />} />
        </Routes>
      </MemoryRouter>
    );

    await user.click(screen.getByText("Remove meal"));

    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByText("Cancel"));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByDisplayValue("Chicken Rice")).toBeInTheDocument();
  });
});

describe("F035: Styling and accessibility", () => {
  it("confirmation dialog has role=dialog and aria-label", async () => {
    const user = userEvent.setup();
    saveHousehold(makeHousehold());

    render(
      <MemoryRouter initialEntries={["/"]}>
        <HouseholdList />
      </MemoryRouter>
    );

    await user.click(screen.getByText("Delete"));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-label");
  });

  it("dialog uses shared styling system with proper buttons", async () => {
    const user = userEvent.setup();
    saveHousehold(makeHousehold());

    render(
      <MemoryRouter initialEntries={["/"]}>
        <HouseholdList />
      </MemoryRouter>
    );

    await user.click(screen.getByText("Delete"));

    const dialog = screen.getByRole("dialog");
    const deleteBtn = within(dialog).getByText("Delete");
    const cancelBtn = within(dialog).getByText("Cancel");
    expect(deleteBtn.tagName).toBe("BUTTON");
    expect(cancelBtn.tagName).toBe("BUTTON");
  });

  it("dialog is not shown by default", () => {
    saveHousehold(makeHousehold());

    render(
      <MemoryRouter initialEntries={["/"]}>
        <HouseholdList />
      </MemoryRouter>
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
