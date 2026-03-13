import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import type { Household, BaseMeal, Ingredient, HouseholdMember } from "../src/types";
import { saveHousehold } from "../src/storage";
import {
  computeIngredientOverlap,
  computeMealOverlap,
} from "../src/planner";
import Planner from "../src/pages/Planner";

const ingredients: Ingredient[] = [
  {
    id: "ing-pasta",
    name: "pasta",
    category: "carb",
    tags: [],
    shelfLifeHint: "",
    freezerFriendly: false,
    babySafeWithAdaptation: true,
  },
  {
    id: "ing-chicken",
    name: "chicken",
    category: "protein",
    tags: [],
    shelfLifeHint: "",
    freezerFriendly: true,
    babySafeWithAdaptation: false,
  },
  {
    id: "ing-mushrooms",
    name: "mushrooms",
    category: "veg",
    tags: [],
    shelfLifeHint: "",
    freezerFriendly: false,
    babySafeWithAdaptation: true,
  },
  {
    id: "ing-broccoli",
    name: "broccoli",
    category: "veg",
    tags: [],
    shelfLifeHint: "",
    freezerFriendly: true,
    babySafeWithAdaptation: true,
  },
];

const members: HouseholdMember[] = [
  {
    id: "m-alex",
    name: "Alex",
    role: "adult",
    safeFoods: ["pasta"],
    hardNoFoods: ["mushrooms"],
    preparationRules: [
      { ingredient: "chicken", rule: "Must be sliced thin" },
    ],
    textureLevel: "regular",
    allergens: [],
    notes: "",
  },
  {
    id: "m-jordan",
    name: "Jordan",
    role: "adult",
    safeFoods: ["pasta", "mushrooms"],
    hardNoFoods: [],
    preparationRules: [],
    textureLevel: "regular",
    allergens: [],
    notes: "",
  },
  {
    id: "m-kid",
    name: "Riley",
    role: "toddler",
    safeFoods: ["pasta"],
    hardNoFoods: ["mushrooms"],
    preparationRules: [],
    textureLevel: "soft",
    allergens: [],
    notes: "",
  },
  {
    id: "m-baby",
    name: "Sam",
    role: "baby",
    safeFoods: ["banana"],
    hardNoFoods: [],
    preparationRules: [],
    textureLevel: "mashable",
    allergens: [],
    notes: "",
  },
];

beforeEach(() => {
  localStorage.clear();
});

describe("F009: Ingredient overlap score", () => {
  it("computes full overlap for universally accepted ingredient", () => {
    const result = computeIngredientOverlap("ing-pasta", members, ingredients);
    expect(result.score).toBe(4);
    expect(result.total).toBe(4);
  });

  it("excludes members with hard-no conflict", () => {
    const result = computeIngredientOverlap("ing-mushrooms", members, ingredients);
    // Alex and Riley have mushrooms as hard-no
    expect(result.score).toBe(2);
    expect(result.total).toBe(4);
    const alexDetail = result.memberDetails.find((d) => d.memberId === "m-alex")!;
    expect(alexDetail.compatibility).toBe("conflict");
    expect(alexDetail.conflicts[0]).toContain("hard-no");
  });

  it("marks baby-unsafe ingredients as conflict for babies", () => {
    const result = computeIngredientOverlap("ing-chicken", members, ingredients);
    const babyDetail = result.memberDetails.find((d) => d.memberId === "m-baby")!;
    expect(babyDetail.compatibility).toBe("conflict");
    expect(babyDetail.conflicts[0]).toContain("not baby-safe");
    // Other 3 can eat it
    expect(result.score).toBe(3);
  });

  it("marks members needing adaptation correctly", () => {
    const result = computeIngredientOverlap("ing-pasta", members, ingredients);
    // Riley (toddler, soft texture) needs adaptation
    const kidDetail = result.memberDetails.find((d) => d.memberId === "m-kid")!;
    expect(kidDetail.compatibility).toBe("with-adaptation");
    // Baby (mashable) needs adaptation
    const babyDetail = result.memberDetails.find((d) => d.memberId === "m-baby")!;
    expect(babyDetail.compatibility).toBe("with-adaptation");
    // Jordan (no constraints) is direct
    const jordanDetail = result.memberDetails.find((d) => d.memberId === "m-jordan")!;
    expect(jordanDetail.compatibility).toBe("direct");
  });

  it("marks members with preparation rules as with-adaptation", () => {
    const result = computeIngredientOverlap("ing-chicken", members, ingredients);
    const alexDetail = result.memberDetails.find((d) => d.memberId === "m-alex")!;
    expect(alexDetail.compatibility).toBe("with-adaptation");
  });
});

describe("F009: Meal overlap score", () => {
  it("computes overlap for a meal with mixed compatibility", () => {
    const meal: BaseMeal = {
      id: "meal-1",
      name: "Pasta with chicken and mushrooms",
      components: [
        { ingredientId: "ing-pasta", role: "carb", quantity: "300g" },
        { ingredientId: "ing-chicken", role: "protein", quantity: "300g" },
        { ingredientId: "ing-mushrooms", role: "veg", quantity: "200g" },
      ],
      defaultPrep: "Cook",
      estimatedTimeMinutes: 25,
      difficulty: "easy",
      rescueEligible: true,
      wasteReuseHints: [],
    };

    const result = computeMealOverlap(meal, members, ingredients);

    // Jordan: no conflicts, direct
    const jordan = result.memberDetails.find((d) => d.memberId === "m-jordan")!;
    expect(jordan.compatibility).toBe("direct");

    // Alex: mushrooms hard-no → conflict
    const alex = result.memberDetails.find((d) => d.memberId === "m-alex")!;
    expect(alex.compatibility).toBe("conflict");
    expect(alex.conflicts.some((c) => c.includes("mushrooms"))).toBe(true);

    // Riley: mushrooms hard-no → conflict
    const riley = result.memberDetails.find((d) => d.memberId === "m-kid")!;
    expect(riley.compatibility).toBe("conflict");

    // Baby: chicken not baby-safe → conflict
    const baby = result.memberDetails.find((d) => d.memberId === "m-baby")!;
    expect(baby.compatibility).toBe("conflict");

    // Only Jordan is fully compatible
    expect(result.score).toBe(1);
    expect(result.total).toBe(4);
  });

  it("computes high overlap for universally accepted meal", () => {
    const meal: BaseMeal = {
      id: "meal-2",
      name: "Simple pasta with broccoli",
      components: [
        { ingredientId: "ing-pasta", role: "carb", quantity: "300g" },
        { ingredientId: "ing-broccoli", role: "veg", quantity: "200g" },
      ],
      defaultPrep: "Cook",
      estimatedTimeMinutes: 15,
      difficulty: "easy",
      rescueEligible: true,
      wasteReuseHints: [],
    };

    const result = computeMealOverlap(meal, members, ingredients);
    // All 4 members can eat it (some with adaptation)
    expect(result.score).toBe(4);
  });

  it("ranks meals by overlap score", () => {
    const lowOverlap: BaseMeal = {
      id: "meal-low",
      name: "Mushroom chicken",
      components: [
        { ingredientId: "ing-chicken", role: "protein", quantity: "300g" },
        { ingredientId: "ing-mushrooms", role: "veg", quantity: "200g" },
      ],
      defaultPrep: "Cook",
      estimatedTimeMinutes: 25,
      difficulty: "easy",
      rescueEligible: false,
      wasteReuseHints: [],
    };

    const highOverlap: BaseMeal = {
      id: "meal-high",
      name: "Pasta broccoli",
      components: [
        { ingredientId: "ing-pasta", role: "carb", quantity: "300g" },
        { ingredientId: "ing-broccoli", role: "veg", quantity: "200g" },
      ],
      defaultPrep: "Cook",
      estimatedTimeMinutes: 15,
      difficulty: "easy",
      rescueEligible: true,
      wasteReuseHints: [],
    };

    const lowResult = computeMealOverlap(lowOverlap, members, ingredients);
    const highResult = computeMealOverlap(highOverlap, members, ingredients);

    expect(highResult.score).toBeGreaterThan(lowResult.score);
  });
});

describe("F009: Overlap display in planner", () => {
  it("shows overlap scores in meal dropdown ranked by overlap", async () => {
    const household: Household = {
      id: "h-overlap",
      name: "Overlap Family",
      members,
      ingredients,
      baseMeals: [
        {
          id: "meal-low",
          name: "Mushroom chicken",
          components: [
            { ingredientId: "ing-chicken", role: "protein", quantity: "300g" },
            { ingredientId: "ing-mushrooms", role: "veg", quantity: "200g" },
          ],
          defaultPrep: "Cook",
          estimatedTimeMinutes: 25,
          difficulty: "easy",
          rescueEligible: false,
          wasteReuseHints: [],
        },
        {
          id: "meal-high",
          name: "Pasta broccoli",
          components: [
            { ingredientId: "ing-pasta", role: "carb", quantity: "300g" },
            { ingredientId: "ing-broccoli", role: "veg", quantity: "200g" },
          ],
          defaultPrep: "Cook",
          estimatedTimeMinutes: 15,
          difficulty: "easy",
          rescueEligible: true,
          wasteReuseHints: [],
        },
      ],
      weeklyPlans: [],
    };
    saveHousehold(household);

    renderPlanner("h-overlap");

    // Meals in dropdown should show overlap scores
    const options = screen.getAllByRole("option");
    // First option is "Choose a meal", then ranked: high overlap first
    expect(options[1]!.textContent).toContain("Pasta broccoli");
    expect(options[1]!.textContent).toContain("4/4");
    expect(options[2]!.textContent).toContain("Mushroom chicken");
  });

  it("shows overlap summary when a meal is selected", async () => {
    const household: Household = {
      id: "h-overlap2",
      name: "Overlap Family 2",
      members: members.slice(0, 2), // Alex and Jordan only
      ingredients,
      baseMeals: [
        {
          id: "meal-1",
          name: "Pasta with mushrooms",
          components: [
            { ingredientId: "ing-pasta", role: "carb", quantity: "300g" },
            { ingredientId: "ing-mushrooms", role: "veg", quantity: "200g" },
          ],
          defaultPrep: "Cook",
          estimatedTimeMinutes: 15,
          difficulty: "easy",
          rescueEligible: true,
          wasteReuseHints: [],
        },
      ],
      weeklyPlans: [],
    };
    saveHousehold(household);

    const user = userEvent.setup();
    renderPlanner("h-overlap2");

    await user.selectOptions(screen.getByRole("combobox"), "meal-1");

    const overlapSection = screen.getByTestId("overlap-summary");
    expect(within(overlapSection).getByText(/1\/2 members compatible/)).toBeInTheDocument();

    // Alex has mushroom conflict
    const alexOverlap = screen.getByTestId("overlap-m-alex");
    expect(alexOverlap.textContent).toContain("conflict");
    expect(alexOverlap.textContent).toContain("mushrooms");

    // Jordan is fine
    const jordanOverlap = screen.getByTestId("overlap-m-jordan");
    expect(jordanOverlap.textContent).toContain("compatible");
  });
});

function renderPlanner(householdId: string) {
  return render(
    <MemoryRouter initialEntries={[`/household/${householdId}/planner`]}>
      <Routes>
        <Route
          path="/household/:householdId/planner"
          element={<Planner />}
        />
      </Routes>
    </MemoryRouter>,
  );
}
