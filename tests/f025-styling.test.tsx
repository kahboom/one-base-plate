import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import type { Household } from "../src/types";
import { saveHousehold } from "../src/storage";
import HouseholdList from "../src/pages/HouseholdList";
import HouseholdSetup from "../src/pages/HouseholdSetup";
import MemberProfile from "../src/pages/MemberProfile";
import IngredientManager from "../src/pages/IngredientManager";
import BaseMealManager from "../src/pages/BaseMealManager";
import Planner from "../src/pages/Planner";
import WeeklyPlanner from "../src/pages/WeeklyPlanner";
import Home from "../src/pages/Home";

function seedHousehold(): Household {
  const household: Household = {
    id: "h-style",
    name: "Style Test Family",
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
    ingredients: [],
    baseMeals: [],
    weeklyPlans: [],
  };
  saveHousehold(household);
  return household;
}

beforeEach(() => {
  localStorage.clear();
});

describe("F025: PageHeader consistency", () => {
  it("HouseholdList uses PageHeader with title and subtitle", () => {
    render(
      <MemoryRouter>
        <HouseholdList />
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: "OneBasePlate" })).toBeInTheDocument();
    expect(screen.getByText("One base meal, multiple household-specific assemblies.")).toBeInTheDocument();
  });

  it("HouseholdSetup uses PageHeader for create mode", () => {
    render(
      <MemoryRouter initialEntries={["/household/new"]}>
        <Routes>
          <Route path="/household/:id" element={<HouseholdSetup />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText("Create Household")).toBeInTheDocument();
  });

  it("Home uses PageHeader with headline", () => {
    seedHousehold();
    render(
      <MemoryRouter initialEntries={["/household/h-style/home"]}>
        <Routes>
          <Route path="/household/:householdId/home" element={<Home />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText("What should we eat tonight?")).toBeInTheDocument();
    expect(screen.getByText("Style Test Family")).toBeInTheDocument();
  });
});

describe("F025: FieldLabel stacked layout", () => {
  it("HouseholdSetup uses stacked labels for household name", () => {
    render(
      <MemoryRouter initialEntries={["/household/new"]}>
        <Routes>
          <Route path="/household/:id" element={<HouseholdSetup />} />
        </Routes>
      </MemoryRouter>,
    );
    const label = screen.getByText("Household name");
    expect(label).toBeInTheDocument();
    expect(label.tagName).toBe("SPAN");
  });

  it("IngredientManager uses stacked labels", () => {
    seedHousehold();
    render(
      <MemoryRouter initialEntries={["/household/h-style/ingredients"]}>
        <Routes>
          <Route path="/household/:householdId/ingredients" element={<IngredientManager />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: "Ingredients" })).toBeInTheDocument();
    expect(screen.getByText(/Household: Style Test Family/)).toBeInTheDocument();
  });

  it("BaseMealManager uses stacked labels for meal fields", async () => {
    seedHousehold();
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/household/h-style/meals"]}>
        <Routes>
          <Route path="/household/:householdId/meals" element={<BaseMealManager />} />
        </Routes>
      </MemoryRouter>,
    );
    await user.click(screen.getByText("Add meal"));
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Default prep")).toBeInTheDocument();
    expect(screen.getByText("Time (minutes)")).toBeInTheDocument();
    expect(screen.getByText("Difficulty")).toBeInTheDocument();
  });
});

describe("F025: Empty states", () => {
  it("HouseholdSetup shows empty state for no members", () => {
    render(
      <MemoryRouter initialEntries={["/household/new"]}>
        <Routes>
          <Route path="/household/:id" element={<HouseholdSetup />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText("No members yet. Add a member to get started.")).toBeInTheDocument();
  });

  it("IngredientManager shows empty state for no ingredients", () => {
    seedHousehold();
    render(
      <MemoryRouter initialEntries={["/household/h-style/ingredients"]}>
        <Routes>
          <Route path="/household/:householdId/ingredients" element={<IngredientManager />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText("No ingredients yet. Add one to get started.")).toBeInTheDocument();
  });

  it("BaseMealManager shows empty state for no meals", () => {
    seedHousehold();
    render(
      <MemoryRouter initialEntries={["/household/h-style/meals"]}>
        <Routes>
          <Route path="/household/:householdId/meals" element={<BaseMealManager />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText("No meals yet. Add one to get started.")).toBeInTheDocument();
  });

  it("Planner shows empty state when no meals exist", () => {
    seedHousehold();
    render(
      <MemoryRouter initialEntries={["/household/h-style/planner"]}>
        <Routes>
          <Route path="/household/:householdId/planner" element={<Planner />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText(/No base meals available/)).toBeInTheDocument();
  });

  it("WeeklyPlanner shows empty state when no meals exist", () => {
    seedHousehold();
    render(
      <MemoryRouter initialEntries={["/household/h-style/weekly"]}>
        <Routes>
          <Route path="/household/:householdId/weekly" element={<WeeklyPlanner />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText(/No base meals available/)).toBeInTheDocument();
  });

  it("MemberProfile shows empty state text for empty safe foods list", () => {
    seedHousehold();
    render(
      <MemoryRouter initialEntries={["/household/h-style/member/m1"]}>
        <Routes>
          <Route path="/household/:householdId/member/:memberId" element={<MemberProfile />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText("No safe foods added yet.")).toBeInTheDocument();
    expect(screen.getByText("No hard-no foods added yet.")).toBeInTheDocument();
    expect(screen.getByText("No preparation rules added yet.")).toBeInTheDocument();
  });

  it("HouseholdList shows empty state when no households exist", () => {
    render(
      <MemoryRouter>
        <HouseholdList />
      </MemoryRouter>,
    );
    expect(screen.getByText("No households yet. Create one to get started.")).toBeInTheDocument();
  });
});

describe("F025: Contrast and focus states", () => {
  it("Button components include focus-visible outline class", async () => {
    render(
      <MemoryRouter>
        <HouseholdList />
      </MemoryRouter>,
    );
    const button = screen.getByText("Create Household");
    expect(button.className).toContain("focus-visible:outline");
  });

  it("existing flows remain intact after styling refactor", async () => {
    seedHousehold();
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/household/h-style/meals"]}>
        <Routes>
          <Route path="/household/:householdId/meals" element={<BaseMealManager />} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByText("Add meal"));
    expect(screen.getByText("Meals (1)")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Meal name")).toBeInTheDocument();
  });
});
