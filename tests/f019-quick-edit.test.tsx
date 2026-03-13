import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import type { Household } from "../src/types";
import { saveHousehold, loadHousehold } from "../src/storage";
import Planner from "../src/pages/Planner";
import MemberProfile from "../src/pages/MemberProfile";
import HouseholdSetup from "../src/pages/HouseholdSetup";
import Home from "../src/pages/Home";

function seedHousehold(): Household {
  const household: Household = {
    id: "h-quick",
    name: "Quick Edit Family",
    members: [
      {
        id: "m-parent",
        name: "Parent",
        role: "adult",
        safeFoods: [],
        hardNoFoods: [],
        preparationRules: [],
        textureLevel: "regular",
        allergens: [],
        notes: "",
      },
      {
        id: "m-kid",
        name: "Kid",
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
    ],
    baseMeals: [
      {
        id: "meal-1",
        name: "Pasta with chicken and mushrooms",
        components: [
          { ingredientId: "ing-pasta", role: "carb", quantity: "300g" },
          { ingredientId: "ing-chicken", role: "protein", quantity: "300g" },
          { ingredientId: "ing-mushrooms", role: "veg", quantity: "200g" },
        ],
        defaultPrep: "Cook pasta, grill chicken, saute mushrooms",
        estimatedTimeMinutes: 25,
        difficulty: "easy",
        rescueEligible: true,
        wasteReuseHints: [],
      },
    ],
    weeklyPlans: [],
  };
  saveHousehold(household);
  return household;
}

function renderApp(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/household/:householdId/home" element={<Home />} />
        <Route path="/household/:id" element={<HouseholdSetup />} />
        <Route
          path="/household/:householdId/planner"
          element={<Planner />}
        />
        <Route
          path="/household/:householdId/member/:memberId"
          element={<MemberProfile />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe("F019: Quick edit link appears in planner", () => {
  it("shows quick edit links for each member in planner variants", async () => {
    seedHousehold();
    const user = userEvent.setup();
    renderApp("/household/h-quick/planner");

    await user.click(screen.getByTestId("selectable-meal-1"));

    expect(screen.getByText("Quick edit Parent")).toBeInTheDocument();
    expect(screen.getByText("Quick edit Kid")).toBeInTheDocument();
  });
});

describe("F019: Quick edit from planner navigates to member profile", () => {
  it("clicking quick edit navigates to member profile", async () => {
    seedHousehold();
    const user = userEvent.setup();
    renderApp("/household/h-quick/planner");

    await user.click(screen.getByTestId("selectable-meal-1"));
    await user.click(screen.getByText("Quick edit Kid"));

    // Should be on member profile page
    expect(screen.getByText(/Kid — toddler/)).toBeInTheDocument();
    expect(screen.getByText("Safe Foods")).toBeInTheDocument();
  });
});

describe("F019: Edit member and return to planner", () => {
  it("adding a hard-no food changes only that member's variant after returning", async () => {
    seedHousehold();
    const user = userEvent.setup();
    renderApp("/household/h-quick/planner");

    // Select meal and verify Kid has no exclusions initially
    await user.click(screen.getByTestId("selectable-meal-1"));
    const kidSection = screen.getByTestId("variant-m-kid");
    expect(within(kidSection).queryByText(/Exclude/)).not.toBeInTheDocument();

    // Navigate to Kid's profile
    await user.click(screen.getByText("Quick edit Kid"));

    // Add mushrooms as hard-no food
    const hardNoInput = screen.getByPlaceholderText("Add hard-no food");
    await user.type(hardNoInput, "mushrooms");
    await user.click(screen.getByText("Add hard-no food"));

    // Save — should navigate back to planner
    await user.click(screen.getByText("Save profile"));

    // Should be back on planner
    expect(screen.getByText("Meal Planner")).toBeInTheDocument();

    // Re-select meal to regenerate variants
    await user.click(screen.getByTestId("selectable-meal-1"));

    // Kid should now have mushrooms excluded
    const updatedKidSection = screen.getByTestId("variant-m-kid");
    expect(within(updatedKidSection).getByText(/Exclude.*mushrooms/)).toBeInTheDocument();

    // Parent should be unaffected
    const parentSection = screen.getByTestId("variant-m-parent");
    expect(within(parentSection).queryByText(/Exclude/)).not.toBeInTheDocument();
  });
});

describe("F019: Edit avoids full household flow", () => {
  it("quick edit does not go through full household setup page", async () => {
    seedHousehold();
    const user = userEvent.setup();
    renderApp("/household/h-quick/planner");

    await user.click(screen.getByTestId("selectable-meal-1"));
    await user.click(screen.getByText("Quick edit Parent"));

    // Should be on member profile, NOT household setup
    expect(screen.getByText(/Parent — adult/)).toBeInTheDocument();
    expect(screen.queryByText("Edit Household")).not.toBeInTheDocument();
    expect(screen.queryByText("Add member")).not.toBeInTheDocument();
  });
});

describe("F019: Cancel from quick edit returns to planner", () => {
  it("cancel navigates back to planner without saving", async () => {
    seedHousehold();
    const user = userEvent.setup();
    renderApp("/household/h-quick/planner");

    await user.click(screen.getByTestId("selectable-meal-1"));
    await user.click(screen.getByText("Quick edit Kid"));

    // Add a hard-no but cancel instead of saving
    const hardNoInput = screen.getByPlaceholderText("Add hard-no food");
    await user.type(hardNoInput, "mushrooms");
    await user.click(screen.getByText("Add hard-no food"));
    await user.click(screen.getByText("Cancel"));

    // Should be back on planner
    expect(screen.getByText("Meal Planner")).toBeInTheDocument();

    // Data should not have changed
    const household = loadHousehold("h-quick")!;
    const kid = household.members.find((m) => m.id === "m-kid")!;
    expect(kid.hardNoFoods).toHaveLength(0);
  });
});

describe("F019: Member profile preserves returnTo for household setup", () => {
  it("without returnTo param, save navigates to home", async () => {
    seedHousehold();
    const user = userEvent.setup();
    renderApp("/household/h-quick/member/m-parent");

    expect(screen.getByText(/Parent — adult/)).toBeInTheDocument();
    await user.click(screen.getByText("Save profile"));

    // Should go to home by default
    expect(screen.getByText("What should we eat tonight?")).toBeInTheDocument();
  });
});
