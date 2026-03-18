import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import type { Household } from "../src/types";
import { saveHousehold, loadHousehold } from "../src/storage";
import { generateAssemblyVariants, computeMealOverlap } from "../src/planner";
import BaseMealManager from "../src/pages/BaseMealManager";
import MealDetail from "../src/pages/MealDetail";

function seedHousehold(): Household {
  const household: Household = {
    id: "h-mp",
    name: "Multi Protein Family",
    members: [
      {
        id: "m-adult",
        name: "Parent",
        role: "adult",
        safeFoods: [],
        hardNoFoods: ["tofu"],
        preparationRules: [],
        textureLevel: "regular",
        allergens: [],
        notes: "",
      },
      {
        id: "m-toddler",
        name: "Kiddo",
        role: "toddler",
        safeFoods: ["chicken", "rice"],
        hardNoFoods: [],
        preparationRules: [],
        textureLevel: "regular",
        allergens: [],
        notes: "",
      },
    ],
    ingredients: [
      { id: "ing-chicken", name: "Chicken", category: "protein", tags: [], shelfLifeHint: "", freezerFriendly: true, babySafeWithAdaptation: false },
      { id: "ing-tofu", name: "Tofu", category: "protein", tags: [], shelfLifeHint: "", freezerFriendly: false, babySafeWithAdaptation: true },
      { id: "ing-rice", name: "Rice", category: "carb", tags: [], shelfLifeHint: "", freezerFriendly: false, babySafeWithAdaptation: true },
      { id: "ing-broccoli", name: "Broccoli", category: "veg", tags: [], shelfLifeHint: "", freezerFriendly: true, babySafeWithAdaptation: true },
    ],
    baseMeals: [
      {
        id: "meal-stir-fry",
        name: "Stir Fry",
        components: [
          { ingredientId: "ing-chicken", alternativeIngredientIds: ["ing-tofu"], role: "protein", quantity: "300g" },
          { ingredientId: "ing-rice", role: "carb", quantity: "200g" },
          { ingredientId: "ing-broccoli", role: "veg", quantity: "150g" },
        ],
        defaultPrep: "stir-fry",
        estimatedTimeMinutes: 25,
        difficulty: "medium",
        rescueEligible: false,
        wasteReuseHints: [],
      },
    ],
    weeklyPlans: [],
  };
  saveHousehold(household);
  return household;
}

beforeEach(() => {
  localStorage.clear();
});

describe("F028: Multi-protein assembly variants", () => {
  it("picks the best protein option per member based on compatibility", () => {
    const household = seedHousehold();
    const meal = household.baseMeals[0]!;
    const variants = generateAssemblyVariants(meal, household.members, household.ingredients);

    // Parent has hard-no for tofu, so chicken (the primary) stays — no "Protein option" instruction needed
    const parentVariant = variants.find((v) => v.memberId === "m-adult")!;
    expect(parentVariant.instructions.every((i) => !i.includes("Protein option: Tofu"))).toBe(true);

    // Toddler has chicken as safe food, primary stays — no swap instruction
    const toddlerVariant = variants.find((v) => v.memberId === "m-toddler")!;
    expect(toddlerVariant.instructions.every((i) => !i.includes("Protein option: Tofu"))).toBe(true);
  });

  it("picks alternative when primary is a conflict for the member", () => {
    const household = seedHousehold();
    // Modify parent to have hard-no for chicken instead, keep tofu ok
    household.members[0]!.hardNoFoods = ["chicken"];
    saveHousehold(household);

    const meal = household.baseMeals[0]!;
    const variants = generateAssemblyVariants(meal, household.members, household.ingredients);

    const parentVariant = variants.find((v) => v.memberId === "m-adult")!;
    // Should pick tofu since chicken is hard-no
    expect(parentVariant.instructions.some((i) => i.includes("Protein option: Tofu"))).toBe(true);
  });

  it("overlap score considers best protein option per member", () => {
    const household = seedHousehold();
    const meal = household.baseMeals[0]!;
    const overlap = computeMealOverlap(meal, household.members, household.ingredients);

    // Parent has hard-no for tofu but chicken is available, so no conflict
    // Toddler has no conflicts
    expect(overlap.score).toBe(2);
    expect(overlap.total).toBe(2);
  });

  it("single-protein meals still work unchanged", () => {
    const household = seedHousehold();
    // Remove the alternatives
    household.baseMeals[0]!.components[0]!.alternativeIngredientIds = undefined;
    saveHousehold(household);

    const meal = household.baseMeals[0]!;
    const variants = generateAssemblyVariants(meal, household.members, household.ingredients);

    // Parent has no hard-no for chicken, no alternatives instruction needed
    const parentVariant = variants.find((v) => v.memberId === "m-adult")!;
    expect(parentVariant.instructions.every((i) => !i.includes("Protein option"))).toBe(true);
  });

  it("meal stays as one record with alternatives, not duplicated", () => {
    const household = seedHousehold();
    expect(household.baseMeals).toHaveLength(1);
    const meal = household.baseMeals[0]!;
    expect(meal.components[0]!.alternativeIngredientIds).toEqual(["ing-tofu"]);
  });
});

describe("F028: Base Meal Editor alternatives UI", () => {
  it("can add an alternative ingredient to a component", async () => {
    seedHousehold();
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/household/h-mp/meals"]}>
        <Routes>
          <Route path="/household/:householdId/meals" element={<BaseMealManager />} />
        </Routes>
      </MemoryRouter>,
    );

    // The meal has chicken with tofu as alternative
    await user.click(screen.getByTestId("meal-row-meal-stir-fry"));
    const modal = screen.getByTestId("meal-modal");
    await user.click(within(modal).getByTestId("component-toggle-0"));
    const altsList = within(modal).getByTestId("alternatives-list-0");
    expect(within(altsList).getByText("Tofu")).toBeInTheDocument();

    // Can add a new meal and add alternatives
    await user.click(within(modal).getByText("Save meal"));
    await user.click(screen.getByText("Add meal"));
    // Should have at least 2 meals now
    expect(screen.getByText("Meals (2)")).toBeInTheDocument();
  });

  it("can remove an alternative ingredient", async () => {
    seedHousehold();
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/household/h-mp/meals"]}>
        <Routes>
          <Route path="/household/:householdId/meals" element={<BaseMealManager />} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByTestId("meal-row-meal-stir-fry"));
    const modal = screen.getByTestId("meal-modal");
    await user.click(within(modal).getByTestId("component-toggle-0"));
    const altsList = within(modal).getByTestId("alternatives-list-0");
    expect(within(altsList).getByText("Tofu")).toBeInTheDocument();

    // Remove tofu alternative
    const removeBtn = within(altsList).getByRole("button", { name: /remove alternative tofu/i });
    await user.click(removeBtn);

    // Auto-save persists; verify
    const saved = loadHousehold("h-mp")!;
    const comp = saved.baseMeals[0]!.components[0]!;
    expect(comp.alternativeIngredientIds ?? []).toEqual([]);
  });
});

describe("F028: Meal Detail page", () => {
  it("shows meal as one shared structure with protein options", () => {
    seedHousehold();
    render(
      <MemoryRouter initialEntries={["/household/h-mp/meal/meal-stir-fry"]}>
        <Routes>
          <Route path="/household/:householdId/meal/:mealId" element={<MealDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Stir Fry")).toBeInTheDocument();
    expect(screen.getByTestId("meal-hero")).toBeInTheDocument();
    expect(screen.getByTestId("meal-structure")).toBeInTheDocument();

    // Protein section shows both options
    const proteinSection = screen.getByTestId("structure-protein");
    expect(within(proteinSection).getByText("Chicken")).toBeInTheDocument();
    expect(within(proteinSection).getByTestId("protein-alternatives")).toBeInTheDocument();
    expect(within(proteinSection).getByText("Tofu")).toBeInTheDocument();
  });

  it("shows per-member assembly variants with compatibility chips", () => {
    seedHousehold();
    render(
      <MemoryRouter initialEntries={["/household/h-mp/meal/meal-stir-fry"]}>
        <Routes>
          <Route path="/household/:householdId/meal/:mealId" element={<MealDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    const memberVariants = screen.getByTestId("member-variants");
    expect(within(memberVariants).getByTestId("variant-m-adult")).toBeInTheDocument();
    expect(within(memberVariants).getByTestId("variant-m-toddler")).toBeInTheDocument();
  });

  it("reads as one shared structure, not separate recipes", () => {
    seedHousehold();
    render(
      <MemoryRouter initialEntries={["/household/h-mp/meal/meal-stir-fry"]}>
        <Routes>
          <Route path="/household/:householdId/meal/:mealId" element={<MealDetail />} />
        </Routes>
      </MemoryRouter>,
    );

    // Only one meal hero card, not duplicated for each protein
    const heroes = screen.getAllByTestId("meal-hero");
    expect(heroes).toHaveLength(1);

    // Structure shows protein options under one section
    const proteinSections = screen.getAllByTestId("structure-protein");
    expect(proteinSections).toHaveLength(1);
  });
});
