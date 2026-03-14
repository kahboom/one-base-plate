import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import type { Household } from "../src/types";
import { saveHousehold, loadHousehold } from "../src/storage";
import BaseMealManager from "../src/pages/BaseMealManager";
import Planner from "../src/pages/Planner";
import WeeklyPlanner from "../src/pages/WeeklyPlanner";
import Home from "../src/pages/Home";

function seedHousehold(): Household {
  const household: Household = {
    id: "h-inline",
    name: "Inline Test Family",
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
    ],
    ingredients: [
      {
        id: "i1",
        name: "Chicken",
        category: "protein",
        tags: [],
        shelfLifeHint: "",
        babySafeWithAdaptation: true,
        freezerFriendly: false,
      },
    ],
    baseMeals: [
      {
        id: "meal1",
        name: "Test Meal",
        components: [{ ingredientId: "i1", role: "protein", quantity: "200g" }],
        defaultPrep: "pan-fry",
        estimatedTimeMinutes: 15,
        difficulty: "easy",
        rescueEligible: false,
        wasteReuseHints: [],
      },
    ],
    weeklyPlans: [],
    pinnedMealIds: [],
  };
  saveHousehold(household);
  return household;
}

function seedEmptyHousehold(): Household {
  const household: Household = {
    id: "h-empty",
    name: "Empty Family",
    members: [
      {
        id: "m1",
        name: "Bob",
        role: "adult",
        safeFoods: [],
        hardNoFoods: [],
        preparationRules: [],
        textureLevel: "regular",
        allergens: [],
        notes: "",
      },
    ],
    ingredients: [],
    baseMeals: [],
    weeklyPlans: [],
    pinnedMealIds: [],
  };
  saveHousehold(household);
  return household;
}

function renderBaseMealManager(householdId: string) {
  return render(
    <MemoryRouter initialEntries={[`/household/${householdId}/meals`]}>
      <Routes>
        <Route path="/household/:householdId/meals" element={<BaseMealManager />} />
        <Route path="/household/:householdId/home" element={<div>Home Page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderPlanner(householdId: string) {
  return render(
    <MemoryRouter initialEntries={[`/household/${householdId}/planner`]}>
      <Routes>
        <Route path="/household/:householdId/planner" element={<Planner />} />
        <Route path="/household/:householdId/ingredients" element={<div>Ingredients Page</div>} />
        <Route path="/household/:householdId/meals" element={<div>Base Meals Page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderWeeklyPlanner(householdId: string) {
  return render(
    <MemoryRouter initialEntries={[`/household/${householdId}/weekly`]}>
      <Routes>
        <Route path="/household/:householdId/weekly" element={<WeeklyPlanner />} />
        <Route path="/household/:householdId/ingredients" element={<div>Ingredients Page</div>} />
        <Route path="/household/:householdId/meals" element={<div>Base Meals Page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe("F038: Inline ingredient creation and discoverable navigation", () => {
  describe("Inline ingredient form in Base Meal Manager", () => {
    it("shows 'Add new ingredient' button in component form", async () => {
      seedHousehold();
      renderBaseMealManager("h-inline");
      const user = userEvent.setup();
      await user.click(screen.getByText("Add meal"));
      expect(screen.getByTestId("add-ingredient-inline")).toBeInTheDocument();
    });

    it("opens inline form when clicking 'Add new ingredient'", async () => {
      seedHousehold();
      renderBaseMealManager("h-inline");
      const user = userEvent.setup();
      await user.click(screen.getByText("Add meal"));
      await user.click(screen.getByTestId("add-ingredient-inline"));
      expect(screen.getByTestId("inline-ingredient-form")).toBeInTheDocument();
      expect(screen.getByTestId("inline-ingredient-name")).toBeInTheDocument();
      expect(screen.getByTestId("inline-ingredient-category")).toBeInTheDocument();
    });

    it("creates ingredient inline and selects it in the component", async () => {
      seedHousehold();
      renderBaseMealManager("h-inline");
      const user = userEvent.setup();
      await user.click(screen.getByText("Add meal"));
      await user.click(screen.getByTestId("add-ingredient-inline"));
      await user.type(screen.getByTestId("inline-ingredient-name"), "Broccoli");
      await user.selectOptions(screen.getByTestId("inline-ingredient-category"), "veg");
      await user.click(screen.getByTestId("inline-ingredient-save"));
      // Form should close
      expect(screen.queryByTestId("inline-ingredient-form")).not.toBeInTheDocument();
      // The new ingredient should appear in the select dropdown options
      const selects = screen.getAllByRole("combobox");
      const ingredientSelect = selects.find((s) => {
        const options = within(s).queryAllByRole("option");
        return options.some((o) => o.textContent?.includes("Broccoli"));
      });
      expect(ingredientSelect).toBeTruthy();
    });

    it("cancels inline form without adding ingredient", async () => {
      seedHousehold();
      renderBaseMealManager("h-inline");
      const user = userEvent.setup();
      await user.click(screen.getByText("Add meal"));
      await user.click(screen.getByTestId("add-ingredient-inline"));
      await user.type(screen.getByTestId("inline-ingredient-name"), "Tofu");
      const inlineForm = screen.getByTestId("inline-ingredient-form");
      await user.click(within(inlineForm).getByText("Cancel"));
      expect(screen.queryByTestId("inline-ingredient-form")).not.toBeInTheDocument();
      // Tofu should not be in any select
      const allOptions = screen.getAllByRole("option");
      expect(allOptions.some((o) => o.textContent?.includes("Tofu"))).toBe(false);
    });

    it("persists inline-created ingredient on save", async () => {
      seedHousehold();
      renderBaseMealManager("h-inline");
      const user = userEvent.setup();
      await user.click(screen.getByText("Add meal"));
      await user.click(screen.getByTestId("add-ingredient-inline"));
      await user.type(screen.getByTestId("inline-ingredient-name"), "Rice");
      await user.selectOptions(screen.getByTestId("inline-ingredient-category"), "carb");
      await user.click(screen.getByTestId("inline-ingredient-save"));
      await user.click(screen.getByText("Save meals"));
      const household = loadHousehold("h-inline");
      expect(household!.ingredients.some((i) => i.name === "Rice")).toBe(true);
    });
  });

  describe("Navigation links for Ingredients and Base meals in HouseholdNav", () => {
    it("HouseholdNav includes Ingredients link", () => {
      seedHousehold();
      render(
        <MemoryRouter initialEntries={["/household/h-inline/home"]}>
          <Routes>
            <Route path="/household/:householdId/home" element={<Home />} />
          </Routes>
        </MemoryRouter>,
      );
      const nav = screen.getByRole("navigation");
      const ingredientsLink = within(nav).getByText("Ingredients");
      expect(ingredientsLink).toBeInTheDocument();
      expect(ingredientsLink.closest("a")).toHaveAttribute("href", "/household/h-inline/ingredients");
    });

    it("HouseholdNav includes Base meals link", () => {
      seedHousehold();
      render(
        <MemoryRouter initialEntries={["/household/h-inline/home"]}>
          <Routes>
            <Route path="/household/:householdId/home" element={<Home />} />
          </Routes>
        </MemoryRouter>,
      );
      const nav = screen.getByRole("navigation");
      const mealsLink = within(nav).getByText("Base meals");
      expect(mealsLink).toBeInTheDocument();
      expect(mealsLink.closest("a")).toHaveAttribute("href", "/household/h-inline/meals");
    });
  });

  describe("Empty state links in Planner and Weekly Planner", () => {
    it("Planner empty state links to ingredients and base meals pages", () => {
      seedEmptyHousehold();
      renderPlanner("h-empty");
      const ingredientsLink = screen.getByText("Add ingredients");
      const mealsLink = screen.getByText("add base meals");
      expect(ingredientsLink.closest("a")).toHaveAttribute("href", "/household/h-empty/ingredients");
      expect(mealsLink.closest("a")).toHaveAttribute("href", "/household/h-empty/meals");
    });

    it("Weekly planner empty state links to ingredients and base meals pages", () => {
      seedEmptyHousehold();
      renderWeeklyPlanner("h-empty");
      const ingredientsLink = screen.getByText("Add ingredients");
      const mealsLink = screen.getByText("add base meals");
      expect(ingredientsLink.closest("a")).toHaveAttribute("href", "/household/h-empty/ingredients");
      expect(mealsLink.closest("a")).toHaveAttribute("href", "/household/h-empty/meals");
    });

    it("Planner empty state link navigates to ingredients page", async () => {
      seedEmptyHousehold();
      renderPlanner("h-empty");
      const user = userEvent.setup();
      await user.click(screen.getByText("Add ingredients"));
      expect(screen.getByText("Ingredients Page")).toBeInTheDocument();
    });

    it("Weekly planner empty state link navigates to base meals page", async () => {
      seedEmptyHousehold();
      renderWeeklyPlanner("h-empty");
      const user = userEvent.setup();
      await user.click(screen.getByText("add base meals"));
      expect(screen.getByText("Base Meals Page")).toBeInTheDocument();
    });
  });

  describe("Ingredient creation without leaving the meal editor", () => {
    it("user stays on Base Meal Manager after creating ingredient inline", async () => {
      seedHousehold();
      renderBaseMealManager("h-inline");
      const user = userEvent.setup();
      await user.click(screen.getByText("Add meal"));
      await user.click(screen.getByTestId("add-ingredient-inline"));
      await user.type(screen.getByTestId("inline-ingredient-name"), "Pasta");
      await user.click(screen.getByTestId("inline-ingredient-save"));
      // Still on the Base Meal Manager page
      expect(screen.getByText("Base Meals")).toBeInTheDocument();
      expect(screen.queryByText("Home Page")).not.toBeInTheDocument();
    });

    it("inline-created ingredient is immediately available in all component selects", async () => {
      seedHousehold();
      renderBaseMealManager("h-inline");
      const user = userEvent.setup();
      // Add a meal with a component
      await user.click(screen.getByText("Add meal"));
      // Create ingredient inline
      await user.click(screen.getByTestId("add-ingredient-inline"));
      await user.type(screen.getByTestId("inline-ingredient-name"), "Tofu");
      await user.selectOptions(screen.getByTestId("inline-ingredient-category"), "protein");
      await user.click(screen.getByTestId("inline-ingredient-save"));
      // The existing meal's component select should also have "Tofu"
      const firstMeal = screen.getAllByTestId(/^meal-/)[0]!;
      const selects = within(firstMeal).getAllByRole("combobox");
      const hasTofu = selects.some((s) => {
        const options = within(s).queryAllByRole("option");
        return options.some((o) => o.textContent?.includes("Tofu"));
      });
      expect(hasTofu).toBe(true);
    });
  });
});
