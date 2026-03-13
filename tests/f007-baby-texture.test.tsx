import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import type { Household, BaseMeal, Ingredient, HouseholdMember } from "../src/types";
import { saveHousehold } from "../src/storage";
import { generateAssemblyVariants } from "../src/planner";
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
    name: "chicken breast",
    category: "protein",
    tags: [],
    shelfLifeHint: "",
    freezerFriendly: true,
    babySafeWithAdaptation: false,
  },
  {
    id: "ing-broccoli",
    name: "broccoli",
    category: "veg",
    tags: ["mashable"],
    shelfLifeHint: "",
    freezerFriendly: true,
    babySafeWithAdaptation: true,
  },
  {
    id: "ing-sweet-potato",
    name: "sweet potato",
    category: "veg",
    tags: ["mashable"],
    shelfLifeHint: "",
    freezerFriendly: true,
    babySafeWithAdaptation: true,
  },
  {
    id: "ing-tomato-sauce",
    name: "tomato sauce",
    category: "pantry",
    tags: [],
    shelfLifeHint: "",
    freezerFriendly: false,
    babySafeWithAdaptation: true,
  },
  {
    id: "ing-steak",
    name: "steak",
    category: "protein",
    tags: [],
    shelfLifeHint: "",
    freezerFriendly: true,
    babySafeWithAdaptation: false,
  },
  {
    id: "ing-nuts",
    name: "whole nuts",
    category: "snack",
    tags: [],
    shelfLifeHint: "",
    freezerFriendly: false,
    babySafeWithAdaptation: false,
  },
];

const baby: HouseholdMember = {
  id: "m-baby",
  name: "Baby",
  role: "baby",
  safeFoods: ["sweet potato", "banana", "avocado"],
  hardNoFoods: ["whole nuts", "honey"],
  preparationRules: [],
  textureLevel: "mashable",
  allergens: [],
  notes: "6 months, no teeth, BLW",
};

const adult: HouseholdMember = {
  id: "m-adult",
  name: "Parent",
  role: "adult",
  safeFoods: [],
  hardNoFoods: [],
  preparationRules: [],
  textureLevel: "regular",
  allergens: [],
  notes: "",
};

beforeEach(() => {
  localStorage.clear();
});

describe("F007: Baby texture transformations", () => {
  it("transforms veg components into soft/mashable guidance for baby", () => {
    const meal: BaseMeal = {
      id: "meal-1",
      name: "Veg pasta bowl",
      components: [
        { ingredientId: "ing-pasta", role: "carb", quantity: "200g" },
        { ingredientId: "ing-broccoli", role: "veg", quantity: "100g" },
        { ingredientId: "ing-sweet-potato", role: "veg", quantity: "100g" },
      ],
      defaultPrep: "Boil pasta, steam veg",
      estimatedTimeMinutes: 20,
      difficulty: "easy",
      rescueEligible: true,
      wasteReuseHints: [],
    };

    const variants = generateAssemblyVariants(meal, [baby], ingredients);
    const babyVariant = variants[0]!;

    expect(babyVariant.instructions.some((i) =>
      i.includes("broccoli") && i.includes("steam until very soft") && i.includes("finger-safe"),
    )).toBe(true);

    expect(babyVariant.instructions.some((i) =>
      i.includes("sweet potato") && i.includes("steam until very soft"),
    )).toBe(true);

    expect(babyVariant.instructions.some((i) =>
      i.includes("pasta") && i.includes("cook until very soft") && i.includes("finger-safe"),
    )).toBe(true);
  });

  it("excludes obviously unsafe non-baby-safe proteins", () => {
    const meal: BaseMeal = {
      id: "meal-2",
      name: "Steak dinner",
      components: [
        { ingredientId: "ing-steak", role: "protein", quantity: "300g" },
        { ingredientId: "ing-broccoli", role: "veg", quantity: "200g" },
        { ingredientId: "ing-pasta", role: "carb", quantity: "300g" },
      ],
      defaultPrep: "Grill steak, steam veg",
      estimatedTimeMinutes: 25,
      difficulty: "medium",
      rescueEligible: false,
      wasteReuseHints: [],
    };

    const variants = generateAssemblyVariants(meal, [baby], ingredients);
    const babyVariant = variants[0]!;

    expect(babyVariant.instructions.some((i) =>
      i.includes("Not suitable for baby") && i.includes("steak"),
    )).toBe(true);

    // Broccoli and pasta should still be included with texture guidance
    expect(babyVariant.instructions.some((i) => i.includes("broccoli"))).toBe(true);
    expect(babyVariant.instructions.some((i) => i.includes("pasta"))).toBe(true);
  });

  it("excludes hard-no foods in addition to baby-unsafe ingredients", () => {
    const meal: BaseMeal = {
      id: "meal-3",
      name: "Nut steak bowl",
      components: [
        { ingredientId: "ing-steak", role: "protein", quantity: "300g" },
        { ingredientId: "ing-nuts", role: "topping", quantity: "50g" },
        { ingredientId: "ing-broccoli", role: "veg", quantity: "200g" },
      ],
      defaultPrep: "Grill, steam",
      estimatedTimeMinutes: 25,
      difficulty: "medium",
      rescueEligible: false,
      wasteReuseHints: [],
    };

    const variants = generateAssemblyVariants(meal, [baby], ingredients);
    const babyVariant = variants[0]!;

    // Nuts excluded via hardNoFoods
    expect(babyVariant.instructions.some((i) =>
      i.includes("Exclude") && i.includes("whole nuts"),
    )).toBe(true);

    // Steak excluded via baby-unsafe
    expect(babyVariant.instructions.some((i) =>
      i.includes("Not suitable for baby") && i.includes("steak"),
    )).toBe(true);

    // Broccoli still included
    expect(babyVariant.instructions.some((i) => i.includes("broccoli"))).toBe(true);
  });

  it("keeps baby variant tied to the base meal when components can be adapted", () => {
    const meal: BaseMeal = {
      id: "meal-4",
      name: "Simple pasta and veg",
      components: [
        { ingredientId: "ing-pasta", role: "carb", quantity: "300g" },
        { ingredientId: "ing-broccoli", role: "veg", quantity: "200g" },
        { ingredientId: "ing-tomato-sauce", role: "sauce", quantity: "1 jar" },
      ],
      defaultPrep: "Boil, steam, sauce",
      estimatedTimeMinutes: 20,
      difficulty: "easy",
      rescueEligible: true,
      wasteReuseHints: [],
    };

    const variants = generateAssemblyVariants(meal, [baby], ingredients);
    const babyVariant = variants[0]!;

    expect(babyVariant.baseMealId).toBe("meal-4");
    // No "Not suitable" or "No compatible components" — all components are adaptable
    expect(babyVariant.instructions.some((i) => i.includes("Not suitable"))).toBe(false);
    expect(babyVariant.instructions.some((i) => i.includes("No compatible"))).toBe(false);

    // All three get texture guidance
    expect(babyVariant.instructions.some((i) => i.includes("pasta"))).toBe(true);
    expect(babyVariant.instructions.some((i) => i.includes("broccoli"))).toBe(true);
    expect(babyVariant.instructions.some((i) => i.includes("tomato sauce") && i.includes("smooth"))).toBe(true);
  });

  it("provides sauce-specific guidance for baby", () => {
    const meal: BaseMeal = {
      id: "meal-5",
      name: "Saucy pasta",
      components: [
        { ingredientId: "ing-pasta", role: "carb", quantity: "300g" },
        { ingredientId: "ing-tomato-sauce", role: "sauce", quantity: "1 jar" },
      ],
      defaultPrep: "Cook and mix",
      estimatedTimeMinutes: 15,
      difficulty: "easy",
      rescueEligible: true,
      wasteReuseHints: [],
    };

    const variants = generateAssemblyVariants(meal, [baby], ingredients);
    const babyVariant = variants[0]!;

    expect(babyVariant.instructions.some((i) =>
      i.includes("tomato sauce") && i.includes("no chunks") && i.includes("smooth"),
    )).toBe(true);
  });

  it("suggests safe food fallback when no baby safe food is in the meal", () => {
    const meal: BaseMeal = {
      id: "meal-6",
      name: "Chicken pasta",
      components: [
        { ingredientId: "ing-chicken", role: "protein", quantity: "300g" },
        { ingredientId: "ing-pasta", role: "carb", quantity: "300g" },
      ],
      defaultPrep: "Cook",
      estimatedTimeMinutes: 20,
      difficulty: "easy",
      rescueEligible: false,
      wasteReuseHints: [],
    };

    const variants = generateAssemblyVariants(meal, [baby], ingredients);
    const babyVariant = variants[0]!;

    expect(babyVariant.safeFoodIncluded).toBe(false);
    expect(babyVariant.instructions.some((i) =>
      i.includes("No safe food in this meal") && i.includes("sweet potato"),
    )).toBe(true);
  });

  it("does not apply baby-unsafe exclusion to adults", () => {
    const meal: BaseMeal = {
      id: "meal-7",
      name: "Steak dinner",
      components: [
        { ingredientId: "ing-steak", role: "protein", quantity: "300g" },
        { ingredientId: "ing-broccoli", role: "veg", quantity: "200g" },
      ],
      defaultPrep: "Grill, steam",
      estimatedTimeMinutes: 25,
      difficulty: "medium",
      rescueEligible: false,
      wasteReuseHints: [],
    };

    const variants = generateAssemblyVariants(meal, [adult, baby], ingredients);
    const adultVariant = variants.find((v) => v.memberId === "m-adult")!;
    const babyVariant = variants.find((v) => v.memberId === "m-baby")!;

    // Adult gets steak normally
    expect(adultVariant.instructions.some((i) => i.includes("Not suitable"))).toBe(false);
    expect(adultVariant.instructions.some((i) => i.includes("no modifications needed"))).toBe(true);

    // Baby has steak excluded
    expect(babyVariant.instructions.some((i) => i.includes("Not suitable for baby") && i.includes("steak"))).toBe(true);
  });
});

describe("F007: Baby variant in planner UI", () => {
  it("shows baby texture adaptations in planner page", async () => {
    const household: Household = {
      id: "h-baby",
      name: "Baby Family",
      members: [adult, baby],
      ingredients,
      baseMeals: [
        {
          id: "meal-pasta",
          name: "Pasta with broccoli",
          components: [
            { ingredientId: "ing-pasta", role: "carb", quantity: "300g" },
            { ingredientId: "ing-broccoli", role: "veg", quantity: "200g" },
            { ingredientId: "ing-chicken", role: "protein", quantity: "300g" },
          ],
          defaultPrep: "Cook pasta, steam broccoli, grill chicken",
          estimatedTimeMinutes: 25,
          difficulty: "easy",
          rescueEligible: true,
          wasteReuseHints: [],
        },
      ],
      weeklyPlans: [],
    };
    saveHousehold(household);

    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/household/h-baby/planner"]}>
        <Routes>
          <Route path="/household/:householdId/planner" element={<Planner />} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByTestId("selectable-meal-pasta"));

    // Baby variant should show texture adaptations
    const babySection = screen.getByTestId("variant-m-baby");
    expect(within(babySection).getByText(/extra prep needed/)).toBeInTheDocument();

    // Chicken should be excluded for baby
    expect(within(babySection).getByText(/Not suitable for baby/)).toBeInTheDocument();

    // Broccoli should have texture guidance
    expect(within(babySection).getByText(/broccoli.*finger-safe/)).toBeInTheDocument();

    // Adult should get chicken normally
    const adultSection = screen.getByTestId("variant-m-adult");
    expect(within(adultSection).queryByText(/Not suitable/)).not.toBeInTheDocument();
  });
});
