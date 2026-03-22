import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { Household, HouseholdMember, Ingredient, BaseMeal } from "../src/types";
import { saveHousehold, loadHousehold, seedIfNeeded } from "../src/storage";
import {
  generateAssemblyVariants,
  computeMealOverlap,
  computeIngredientOverlap,
  generateMealExplanation,
  generateShortReason,
  generateRescueMeals,
} from "../src/planner";
import HouseholdSetup from "../src/pages/HouseholdSetup";
import HouseholdLayout from "../src/layouts/HouseholdLayout";
import Planner from "../src/pages/Planner";

const petMember: HouseholdMember = {
  id: "M-Lex",
  name: "Lex",
  role: "pet",
  safeFoods: [],
  hardNoFoods: [],
  preparationRules: [],
  textureLevel: "regular",
  allergens: [],
  notes: "Dog. Excluded from meal assembly.",
};

const adultMember: HouseholdMember = {
  id: "M-Aaron",
  name: "Aaron",
  role: "adult",
  safeFoods: ["pasta", "rice", "chicken"],
  hardNoFoods: [],
  preparationRules: [],
  textureLevel: "regular",
  allergens: [],
  notes: "",
};

const toddlerMember: HouseholdMember = {
  id: "M-Indy",
  name: "Indy",
  role: "toddler",
  safeFoods: ["pasta", "bread", "cheese"],
  hardNoFoods: ["spicy sauce"],
  preparationRules: [],
  textureLevel: "soft",
  allergens: [],
  notes: "",
};

const babyMember: HouseholdMember = {
  id: "M-Orla",
  name: "Orla",
  role: "baby",
  safeFoods: ["sweet potato"],
  hardNoFoods: [],
  preparationRules: [],
  textureLevel: "mashable",
  allergens: [],
  notes: "",
};

const ingredients: Ingredient[] = [
  { id: "ing-pasta", name: "pasta", category: "carb", tags: ["staple"], shelfLifeHint: "long", freezerFriendly: false, babySafeWithAdaptation: true },
  { id: "ing-chicken", name: "chicken breast", category: "protein", tags: [], shelfLifeHint: "3 days", freezerFriendly: true, babySafeWithAdaptation: true },
  { id: "ing-broccoli", name: "broccoli", category: "veg", tags: [], shelfLifeHint: "5 days", freezerFriendly: true, babySafeWithAdaptation: true },
  { id: "ing-sauce", name: "tomato sauce", category: "pantry", tags: [], shelfLifeHint: "long", freezerFriendly: false, babySafeWithAdaptation: true },
];

const testMeal: BaseMeal = {
  id: "bm-test",
  name: "Pasta with chicken",
  components: [
    { ingredientId: "ing-pasta", role: "carb", quantity: "400g" },
    { ingredientId: "ing-chicken", role: "protein", quantity: "500g" },
    { ingredientId: "ing-broccoli", role: "veg", quantity: "1 head" },
    { ingredientId: "ing-sauce", role: "sauce", quantity: "1 jar" },
  ],
  defaultPrep: "Cook and serve.",
  estimatedTimeMinutes: 30,
  difficulty: "easy",
  rescueEligible: true,
  wasteReuseHints: [],
};

const membersWithPet = [adultMember, toddlerMember, babyMember, petMember];
const membersWithoutPet = [adultMember, toddlerMember, babyMember];

function makeHousehold(members: HouseholdMember[]): Household {
  return {
    id: "H004",
    name: "McG family",
    members,
    ingredients,
    recipes: [],
    baseMeals: [testMeal],
    weeklyPlans: [],
    pinnedMealIds: [],
  };
}

beforeEach(() => {
  localStorage.clear();
});

describe("F040: Pet member role type", () => {
  it("MemberRole accepts 'pet' as a valid value", () => {
    expect(petMember.role).toBe("pet");
  });

  it("household can contain a pet member alongside human members", () => {
    const household = makeHousehold(membersWithPet);
    saveHousehold(household);
    const loaded = loadHousehold("H004");
    expect(loaded!.members).toHaveLength(4);
    expect(loaded!.members.find((m) => m.role === "pet")?.name).toBe("Lex");
  });
});

describe("F040: Pet exclusion from assembly variants", () => {
  it("generateAssemblyVariants excludes pet members", () => {
    const variants = generateAssemblyVariants(testMeal, membersWithPet, ingredients);
    expect(variants).toHaveLength(3);
    expect(variants.find((v) => v.memberId === "M-Lex")).toBeUndefined();
  });

  it("generates the same variants whether pet is included or not", () => {
    const withPet = generateAssemblyVariants(testMeal, membersWithPet, ingredients);
    const withoutPet = generateAssemblyVariants(testMeal, membersWithoutPet, ingredients);
    expect(withPet).toEqual(withoutPet);
  });
});

describe("F040: Pet exclusion from overlap scoring", () => {
  it("computeMealOverlap excludes pet from total count", () => {
    const overlap = computeMealOverlap(testMeal, membersWithPet, ingredients);
    expect(overlap.total).toBe(3);
    expect(overlap.memberDetails.find((d) => d.memberId === "M-Lex")).toBeUndefined();
  });

  it("computeIngredientOverlap excludes pet from total count", () => {
    const overlap = computeIngredientOverlap("ing-pasta", membersWithPet, ingredients);
    expect(overlap.total).toBe(3);
    expect(overlap.memberDetails.find((d) => d.memberId === "M-Lex")).toBeUndefined();
  });

  it("overlap scores are identical with and without pet member", () => {
    const withPet = computeMealOverlap(testMeal, membersWithPet, ingredients);
    const withoutPet = computeMealOverlap(testMeal, membersWithoutPet, ingredients);
    expect(withPet.score).toBe(withoutPet.score);
    expect(withPet.total).toBe(withoutPet.total);
  });
});

describe("F040: Pet exclusion from rescue mode", () => {
  it("generateRescueMeals excludes pet from variant generation", () => {
    const rescueMeals = generateRescueMeals([testMeal], membersWithPet, ingredients, "low-energy");
    expect(rescueMeals.length).toBeGreaterThan(0);
    for (const rm of rescueMeals) {
      expect(rm.variants.find((v) => v.memberId === "M-Lex")).toBeUndefined();
      expect(rm.variants).toHaveLength(3);
    }
  });

  it("rescue overlap excludes pet from scoring", () => {
    const rescueMeals = generateRescueMeals([testMeal], membersWithPet, ingredients, "low-time");
    expect(rescueMeals[0]!.overlap.total).toBe(3);
  });
});

describe("F040: Pet exclusion from explanations", () => {
  it("generateMealExplanation excludes pet member", () => {
    const explanation = generateMealExplanation(testMeal, membersWithPet, ingredients);
    expect(explanation.summary).not.toContain("Lex");
  });

  it("generateShortReason excludes pet member", () => {
    const reason = generateShortReason(testMeal, membersWithPet, ingredients);
    expect(reason).not.toContain("Lex");
  });
});

describe("F040: HouseholdSetup includes pet role option", () => {
  it("role selector includes 'pet' option", async () => {
    const user = userEvent.setup();
    const household = makeHousehold([{ ...adultMember, id: "m1", name: "Test" }]);
    saveHousehold(household);

    render(
      <MemoryRouter initialEntries={["/household/H004"]}>
        <Routes>
          <Route path="/household/:householdId" element={<HouseholdLayout />}>
            <Route index element={<HouseholdSetup />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    const memberCard = screen.getAllByTestId(/^member-/)[0]!;
    await user.click(within(memberCard).getByRole("button", { name: "Edit" }));

    const membersSection = screen.getByTestId("members-section");
    const selects = within(membersSection).getAllByRole("combobox");
    const roleSelect = selects.find((s) => {
      const options = Array.from(s.querySelectorAll("option"));
      return options.some((o) => o.value === "adult");
    });
    expect(roleSelect).toBeDefined();
    const options = Array.from(roleSelect!.querySelectorAll("option")).map((o) => o.value);
    expect(options).toContain("pet");
  });
});

describe("F040: Seed script and seeding", () => {
  it("seedIfNeeded populates storage when empty", () => {
    expect(localStorage.getItem("onebaseplate_households")).toBeNull();
    seedIfNeeded();
    const raw = localStorage.getItem("onebaseplate_households");
    expect(raw).not.toBeNull();
    const data = JSON.parse(raw!);
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThanOrEqual(1);
  });

  it("seedIfNeeded does not overwrite existing data", () => {
    const existing = [{ id: "test", name: "Existing" }];
    localStorage.setItem("onebaseplate_households", JSON.stringify(existing));
    seedIfNeeded();
    const raw = localStorage.getItem("onebaseplate_households");
    const data = JSON.parse(raw!);
    expect(data).toHaveLength(1);
    expect(data[0].name).toBe("Existing");
  });

  it("seedIfNeeded does not re-seed after seeded flag is set", () => {
    seedIfNeeded();
    localStorage.removeItem("onebaseplate_households");
    seedIfNeeded();
    expect(localStorage.getItem("onebaseplate_households")).toBeNull();
  });

  it("seed data contains McG family (H004)", () => {
    seedIfNeeded();
    const raw = localStorage.getItem("onebaseplate_households");
    const data = JSON.parse(raw!) as Household[];
    const mcg = data.find((h) => h.id === "H004");
    expect(mcg).toBeDefined();
    expect(mcg!.name).toBe("McG family");
  });

  it("McG family includes pet member Lex", () => {
    seedIfNeeded();
    const raw = localStorage.getItem("onebaseplate_households");
    const data = JSON.parse(raw!) as Household[];
    const mcg = data.find((h) => h.id === "H004")!;
    const lex = mcg.members.find((m) => m.name === "Lex");
    expect(lex).toBeDefined();
    expect(lex!.role).toBe("pet");
  });
});

describe("F040: Planner UI excludes pet from variants", () => {
  it("planner does not show variant for pet member", () => {
    const household = makeHousehold(membersWithPet);
    saveHousehold(household);

    render(
      <MemoryRouter initialEntries={["/household/H004/planner"]}>
        <Routes>
          <Route path="/household/:householdId/planner" element={<Planner />} />
        </Routes>
      </MemoryRouter>,
    );

    const card = screen.getByTestId(`selectable-${testMeal.id}`);
    card.click();

    expect(screen.queryByText(/Lex/)).toBeNull();
    expect(screen.getAllByText(/Aaron/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Indy/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Orla/).length).toBeGreaterThan(0);
  });
});
