import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import type { Household } from "../src/types";
import { saveHousehold, loadHouseholds } from "../src/storage";
import HouseholdList from "../src/pages/HouseholdList";
import HouseholdSetup from "../src/pages/HouseholdSetup";
import HouseholdLayout from "../src/layouts/HouseholdLayout";
import { householdLayoutRouteBranch } from "./householdLayoutRoutes";

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

async function openHouseholdDeleteConfirm(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /edit test family/i }));
  await user.click(screen.getByRole("button", { name: /delete household/i }));
}

describe("F035: Delete household confirmation", () => {
  it("shows confirmation dialog when Delete is clicked", async () => {
    const user = userEvent.setup();
    saveHousehold(makeHousehold());

    render(
      <MemoryRouter initialEntries={["/"]}>
        <HouseholdList />
      </MemoryRouter>
    );

    await openHouseholdDeleteConfirm(user);
    const dialog = screen.getByRole("dialog", { name: "Delete household" });
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

    await openHouseholdDeleteConfirm(user);
    const dialog = screen.getByRole("dialog", { name: "Delete household" });
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

    await openHouseholdDeleteConfirm(user);
    // Household still exists before confirmation
    expect(loadHouseholds()).toHaveLength(1);

    // Click the confirm Delete button inside dialog
    const dialog = screen.getByRole("dialog", { name: "Delete household" });
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

    await openHouseholdDeleteConfirm(user);
    const dialog = screen.getByRole("dialog", { name: "Delete household" });
    await user.click(within(dialog).getByText("Cancel"));

    expect(screen.queryByRole("dialog", { name: "Delete household" })).not.toBeInTheDocument();
    expect(loadHouseholds()).toHaveLength(1);
    expect(screen.getByTestId("household-row-h1")).toBeInTheDocument();
  });
});

describe("F035: Remove member confirmation", () => {
  it("shows confirmation dialog with member name", async () => {
    const user = userEvent.setup();
    saveHousehold(makeHousehold());

    render(
      <MemoryRouter initialEntries={["/household/h1"]}>
        <Routes>
          <Route path="/household/:householdId" element={<HouseholdLayout />}>
            <Route index element={<HouseholdSetup />} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    const membersSection = screen.getByTestId("members-section");
    const removeBtns = within(membersSection).getAllByRole("button", { name: "Remove" });
    await user.click(removeBtns[0]!);

    const dialog = screen.getByRole("dialog", { name: "Remove member" });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText(/Alice/)).toBeInTheDocument();
  });

  it("removes member only after confirming", async () => {
    const user = userEvent.setup();
    saveHousehold(makeHousehold());

    render(
      <MemoryRouter initialEntries={["/household/h1"]}>
        <Routes>
          <Route path="/household/:householdId" element={<HouseholdLayout />}>
            <Route index element={<HouseholdSetup />} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    const membersSection = screen.getByTestId("members-section");
    const removeBtns = within(membersSection).getAllByRole("button", { name: "Remove" });
    await user.click(removeBtns[0]!);

    // Member still visible before confirmation
    expect(screen.getByText("Alice")).toBeInTheDocument();

    const dialog = screen.getByRole("dialog", { name: "Remove member" });
    await user.click(within(dialog).getByText("Remove"));

    expect(screen.queryByText("Alice")).not.toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  it("cancels member removal and keeps member", async () => {
    const user = userEvent.setup();
    saveHousehold(makeHousehold());

    render(
      <MemoryRouter initialEntries={["/household/h1"]}>
        <Routes>
          <Route path="/household/:householdId" element={<HouseholdLayout />}>
            <Route index element={<HouseholdSetup />} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    const membersSection = screen.getByTestId("members-section");
    const removeBtns = within(membersSection).getAllByRole("button", { name: "Remove" });
    await user.click(removeBtns[0]!);

    const dialog = screen.getByRole("dialog", { name: "Remove member" });
    await user.click(within(dialog).getByText("Cancel"));

    expect(screen.queryByRole("dialog", { name: "Remove member" })).not.toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });
});

describe("F035: Remove meal confirmation", () => {
  it("shows confirmation dialog with meal name", async () => {
    const user = userEvent.setup();
    saveHousehold(makeHousehold());

    render(
      <MemoryRouter initialEntries={["/household/h1/meals"]}>
        <Routes>{householdLayoutRouteBranch}</Routes>
      </MemoryRouter>
    );

    await user.click(screen.getByTestId("meal-row-meal1"));
    const modal = screen.getByTestId("meal-modal");
    await user.click(within(modal).getByText("Remove meal"));

    const dialog = screen.getByRole("dialog", { name: "Remove meal" });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText(/Chicken Rice/)).toBeInTheDocument();
  });

  it("removes meal only after confirming", async () => {
    const user = userEvent.setup();
    saveHousehold(makeHousehold());

    render(
      <MemoryRouter initialEntries={["/household/h1/meals"]}>
        <Routes>{householdLayoutRouteBranch}</Routes>
      </MemoryRouter>
    );

    await user.click(screen.getByTestId("meal-row-meal1"));
    const modal = screen.getByTestId("meal-modal");
    await user.click(within(modal).getByText("Remove meal"));
    expect(screen.getByDisplayValue("Chicken Rice")).toBeInTheDocument();

    const dialog = screen.getByRole("dialog", { name: "Remove meal" });
    await user.click(within(dialog).getByText("Remove"));

    expect(screen.queryByDisplayValue("Chicken Rice")).not.toBeInTheDocument();
  });

  it("cancels meal removal", async () => {
    const user = userEvent.setup();
    saveHousehold(makeHousehold());

    render(
      <MemoryRouter initialEntries={["/household/h1/meals"]}>
        <Routes>{householdLayoutRouteBranch}</Routes>
      </MemoryRouter>
    );

    await user.click(screen.getByTestId("meal-row-meal1"));
    const mealModal = screen.getByTestId("meal-modal");
    await user.click(within(mealModal).getByText("Remove meal"));

    const dialog = screen.getByRole("dialog", { name: "Remove meal" });
    await user.click(within(dialog).getByText("Cancel"));

    expect(screen.queryByRole("dialog", { name: "Remove meal" })).not.toBeInTheDocument();
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

    await openHouseholdDeleteConfirm(user);

    const dialog = screen.getByRole("dialog", { name: "Delete household" });
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

    await openHouseholdDeleteConfirm(user);

    const dialog = screen.getByRole("dialog", { name: "Delete household" });
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
