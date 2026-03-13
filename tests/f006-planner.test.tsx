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
    id: "ing-mushrooms",
    name: "mushrooms",
    category: "veg",
    tags: [],
    shelfLifeHint: "",
    freezerFriendly: false,
    babySafeWithAdaptation: false,
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
];

const baseMeal: BaseMeal = {
  id: "meal-pasta",
  name: "Pasta with chicken and veg",
  components: [
    { ingredientId: "ing-pasta", role: "carb", quantity: "400g" },
    { ingredientId: "ing-chicken", role: "protein", quantity: "500g" },
    { ingredientId: "ing-broccoli", role: "veg", quantity: "1 head" },
    { ingredientId: "ing-mushrooms", role: "veg", quantity: "200g" },
    { ingredientId: "ing-tomato-sauce", role: "sauce", quantity: "1 jar" },
  ],
  defaultPrep: "Cook pasta. Grill chicken. Steam veg.",
  estimatedTimeMinutes: 30,
  difficulty: "easy",
  rescueEligible: true,
  wasteReuseHints: [],
};

const members: HouseholdMember[] = [
  {
    id: "m-alex",
    name: "Alex",
    role: "adult",
    safeFoods: ["pasta", "chicken breast", "broccoli"],
    hardNoFoods: ["mushrooms"],
    preparationRules: [
      { ingredient: "chicken breast", rule: "Must be sliced thin" },
      { ingredient: "broccoli", rule: "Must be steamed, not raw" },
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
    id: "m-riley",
    name: "Riley",
    role: "toddler",
    safeFoods: ["pasta", "bread", "cheese"],
    hardNoFoods: ["mushrooms"],
    preparationRules: [
      { ingredient: "pasta", rule: "Must be small shapes" },
    ],
    textureLevel: "soft",
    allergens: [],
    notes: "",
  },
  {
    id: "m-sam",
    name: "Sam",
    role: "baby",
    safeFoods: ["sweet potato", "banana", "avocado"],
    hardNoFoods: ["mushrooms"],
    preparationRules: [],
    textureLevel: "mashable",
    allergens: [],
    notes: "",
  },
];

function seedHousehold(): Household {
  const household: Household = {
    id: "h-planner",
    name: "Planner Test Family",
    members,
    ingredients,
    baseMeals: [baseMeal],
    weeklyPlans: [],
  };
  saveHousehold(household);
  return household;
}

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

beforeEach(() => {
  localStorage.clear();
});

describe("F006: Assembly variant generation engine", () => {
  it("excludes hard-no ingredients for members who reject them", () => {
    const variants = generateAssemblyVariants(baseMeal, members, ingredients);
    const alex = variants.find((v) => v.memberId === "m-alex")!;
    expect(alex.instructions.some((i) => i.includes("Exclude: mushrooms"))).toBe(true);
  });

  it("adds preparation rules as instructions", () => {
    const variants = generateAssemblyVariants(baseMeal, members, ingredients);
    const alex = variants.find((v) => v.memberId === "m-alex")!;
    expect(alex.instructions.some((i) => i.includes("Must be sliced thin"))).toBe(true);
    expect(alex.instructions.some((i) => i.includes("Must be steamed"))).toBe(true);
    expect(alex.requiresExtraPrep).toBe(true);
  });

  it("marks safe food included when member has matching component", () => {
    const variants = generateAssemblyVariants(baseMeal, members, ingredients);
    const alex = variants.find((v) => v.memberId === "m-alex")!;
    expect(alex.safeFoodIncluded).toBe(true);

    const jordan = variants.find((v) => v.memberId === "m-jordan")!;
    expect(jordan.safeFoodIncluded).toBe(true);
  });

  it("generates no-modification instruction for unconstrained member", () => {
    const variants = generateAssemblyVariants(baseMeal, members, ingredients);
    const jordan = variants.find((v) => v.memberId === "m-jordan")!;
    expect(jordan.instructions.some((i) => i.includes("no modifications needed"))).toBe(true);
    expect(jordan.requiresExtraPrep).toBe(false);
  });

  it("adds texture instructions for toddler with soft texture", () => {
    const variants = generateAssemblyVariants(baseMeal, members, ingredients);
    const riley = variants.find((v) => v.memberId === "m-riley")!;
    expect(riley.instructions.some((i) => i.includes("ensure soft texture"))).toBe(true);
    expect(riley.requiresExtraPrep).toBe(true);
  });

  it("adds texture instructions for baby with mashable texture", () => {
    const variants = generateAssemblyVariants(baseMeal, members, ingredients);
    const sam = variants.find((v) => v.memberId === "m-sam")!;
    expect(sam.instructions.some((i) => i.includes("mash or cut"))).toBe(true);
    expect(sam.requiresExtraPrep).toBe(true);
  });

  it("flags non-baby-safe ingredients for baby", () => {
    const variants = generateAssemblyVariants(baseMeal, members, ingredients);
    const sam = variants.find((v) => v.memberId === "m-sam")!;
    expect(sam.instructions.some((i) => i.includes("chicken breast") && i.includes("texture safety"))).toBe(true);
  });

  it("suggests fallback safe foods for baby when none match components", () => {
    const variants = generateAssemblyVariants(baseMeal, members, ingredients);
    const sam = variants.find((v) => v.memberId === "m-sam")!;
    expect(sam.safeFoodIncluded).toBe(false);
    expect(sam.instructions.some((i) => i.includes("Add a safe food on the side"))).toBe(true);
    expect(sam.instructions.some((i) => i.includes("sweet potato"))).toBe(true);
  });

  it("generates variants for all household members", () => {
    const variants = generateAssemblyVariants(baseMeal, members, ingredients);
    expect(variants).toHaveLength(4);
    expect(variants.map((v) => v.memberId)).toEqual([
      "m-alex", "m-jordan", "m-riley", "m-sam",
    ]);
  });
});

describe("F006: Planner page selects meal and shows variants", () => {
  it("shows meal selection and generates per-person assembly", async () => {
    seedHousehold();
    const user = userEvent.setup();
    renderPlanner("h-planner");

    expect(screen.getByText("Meal Planner")).toBeInTheDocument();
    expect(screen.getByText(/Planner Test Family/)).toBeInTheDocument();

    await user.selectOptions(
      screen.getByRole("combobox"),
      "meal-pasta",
    );

    const planSection = screen.getByTestId("meal-plan");
    expect(within(planSection).getByText("Pasta with chicken and veg")).toBeInTheDocument();

    // Verify all 4 members have variant sections
    expect(screen.getByTestId("variant-m-alex")).toBeInTheDocument();
    expect(screen.getByTestId("variant-m-jordan")).toBeInTheDocument();
    expect(screen.getByTestId("variant-m-riley")).toBeInTheDocument();
    expect(screen.getByTestId("variant-m-sam")).toBeInTheDocument();

    // Verify Alex gets extra prep flag
    const alexSection = screen.getByTestId("variant-m-alex");
    expect(within(alexSection).getByText(/extra prep needed/)).toBeInTheDocument();

    // Verify Jordan has no extra prep
    const jordanSection = screen.getByTestId("variant-m-jordan");
    expect(within(jordanSection).queryByText(/extra prep needed/)).not.toBeInTheDocument();
  });

  it("shows shared base meal components", async () => {
    seedHousehold();
    const user = userEvent.setup();
    renderPlanner("h-planner");

    await user.selectOptions(screen.getByRole("combobox"), "meal-pasta");

    expect(screen.getByText("Shared base")).toBeInTheDocument();
    expect(screen.getByText(/pasta \(carb/)).toBeInTheDocument();
    expect(screen.getByText(/chicken breast \(protein/)).toBeInTheDocument();
    expect(screen.getByText(/broccoli \(veg/)).toBeInTheDocument();
  });

  it("shows empty state when no meals exist", () => {
    const household: Household = {
      id: "h-empty",
      name: "Empty Family",
      members: [],
      ingredients: [],
      baseMeals: [],
      weeklyPlans: [],
    };
    saveHousehold(household);
    renderPlanner("h-empty");

    expect(screen.getByText("No base meals available. Add meals first.")).toBeInTheDocument();
  });
});
