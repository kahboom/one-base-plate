import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, within, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import type { Household } from "../src/types";
import { saveHousehold } from "../src/storage";
import Home from "../src/pages/Home";
import Planner from "../src/pages/Planner";
import WeeklyPlanner from "../src/pages/WeeklyPlanner";
import GroceryList from "../src/pages/GroceryList";
import RescueMode from "../src/pages/RescueMode";
import MealDetail from "../src/pages/MealDetail";
import IngredientManager from "../src/pages/IngredientManager";
import BaseMealManager from "../src/pages/BaseMealManager";
import HouseholdSetup from "../src/pages/HouseholdSetup";
import MealHistory from "../src/pages/MealHistory";
import MemberProfile from "../src/pages/MemberProfile";

function seedHousehold(): Household {
  const household: Household = {
    id: "h-nav",
    name: "Nav Test Family",
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
        babySafeWithAdaptation: true,
        freezerFriendly: false,
      },
    ],
    baseMeals: [
      {
        id: "meal1",
        name: "Test Meal",
        components: [{ ingredientId: "i1", role: "protein", quantity: "200g" }],
        prepTimeMinutes: 15,
        difficulty: "easy",
        rescueEligible: true,
        defaultPrepMethod: "pan-fry",
      },
    ],
    weeklyPlans: [],
    pinnedMealIds: [],
  };
  saveHousehold(household);
  return household;
}

const NAV_LINKS = [
  "Home",
  "Weekly planner",
  "Meal planner",
  "Grocery list",
  "Rescue mode",
  "Meal history",
  "Ingredients",
  "Base meals",
  "Household setup",
  "All households",
];

function renderRoute(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/household/:householdId/home" element={<Home />} />
        <Route path="/household/:householdId/planner" element={<Planner />} />
        <Route path="/household/:householdId/weekly" element={<WeeklyPlanner />} />
        <Route path="/household/:householdId/grocery" element={<GroceryList />} />
        <Route path="/household/:householdId/rescue" element={<RescueMode />} />
        <Route path="/household/:householdId/meal/:mealId" element={<MealDetail />} />
        <Route path="/household/:householdId/ingredients" element={<IngredientManager />} />
        <Route path="/household/:householdId/meals" element={<BaseMealManager />} />
        <Route path="/household/:householdId/history" element={<MealHistory />} />
        <Route path="/household/:householdId/member/:memberId" element={<MemberProfile />} />
        <Route path="/household/:id" element={<HouseholdSetup />} />
        <Route path="/" element={<div>All Households Page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe("F036: Consistent navigation across all household screens", () => {
  describe("HouseholdNav appears with consistent links on all pages", () => {
    it("Home page has all nav links", () => {
      seedHousehold();
      renderRoute("/household/h-nav/home");
      const nav = screen.getByRole("navigation");
      for (const label of NAV_LINKS) {
        expect(within(nav).getByText(label)).toBeInTheDocument();
      }
    });

    it("Planner page has all nav links", () => {
      seedHousehold();
      renderRoute("/household/h-nav/planner");
      const nav = screen.getByRole("navigation");
      for (const label of NAV_LINKS) {
        expect(within(nav).getByText(label)).toBeInTheDocument();
      }
    });

    it("Weekly planner page has all nav links", () => {
      seedHousehold();
      renderRoute("/household/h-nav/weekly");
      const nav = screen.getByRole("navigation");
      for (const label of NAV_LINKS) {
        expect(within(nav).getByText(label)).toBeInTheDocument();
      }
    });

    it("Grocery list page has all nav links", () => {
      seedHousehold();
      renderRoute("/household/h-nav/grocery");
      const nav = screen.getByRole("navigation");
      for (const label of NAV_LINKS) {
        expect(within(nav).getByText(label)).toBeInTheDocument();
      }
    });

    it("Rescue mode page has all nav links", () => {
      seedHousehold();
      renderRoute("/household/h-nav/rescue");
      const nav = screen.getByRole("navigation");
      for (const label of NAV_LINKS) {
        expect(within(nav).getByText(label)).toBeInTheDocument();
      }
    });

    it("Meal detail page has all nav links", () => {
      seedHousehold();
      renderRoute("/household/h-nav/meal/meal1");
      const nav = screen.getByRole("navigation");
      for (const label of NAV_LINKS) {
        expect(within(nav).getByText(label)).toBeInTheDocument();
      }
    });

    it("Ingredient manager page has all nav links", () => {
      seedHousehold();
      renderRoute("/household/h-nav/ingredients");
      const nav = screen.getByRole("navigation");
      for (const label of NAV_LINKS) {
        expect(within(nav).getByText(label)).toBeInTheDocument();
      }
    });

    it("Base meal manager page has all nav links", () => {
      seedHousehold();
      renderRoute("/household/h-nav/meals");
      const nav = screen.getByRole("navigation");
      for (const label of NAV_LINKS) {
        expect(within(nav).getByText(label)).toBeInTheDocument();
      }
    });

    it("Meal history page has all nav links", () => {
      seedHousehold();
      renderRoute("/household/h-nav/history");
      const nav = screen.getByRole("navigation");
      for (const label of NAV_LINKS) {
        expect(within(nav).getByText(label)).toBeInTheDocument();
      }
    });

    it("Household setup page has all nav links for saved household", () => {
      seedHousehold();
      renderRoute("/household/h-nav");
      const nav = screen.getByRole("navigation");
      for (const label of NAV_LINKS) {
        expect(within(nav).getByText(label)).toBeInTheDocument();
      }
    });
  });

  describe("No 'Back to household' buttons remain", () => {
    it("Planner does not have Back to household button", () => {
      seedHousehold();
      renderRoute("/household/h-nav/planner");
      expect(screen.queryByText(/back to household/i)).not.toBeInTheDocument();
    });

    it("Weekly planner does not have Back to household button", () => {
      seedHousehold();
      renderRoute("/household/h-nav/weekly");
      expect(screen.queryByText(/back to household/i)).not.toBeInTheDocument();
    });
  });

  describe("Home is the canonical hub — nav links route to /home", () => {
    it("Home link in nav points to /household/:id/home", () => {
      seedHousehold();
      renderRoute("/household/h-nav/weekly");
      const nav = screen.getByRole("navigation");
      const homeLink = within(nav).getByText("Home");
      expect(homeLink.closest("a")).toHaveAttribute("href", "/household/h-nav/home");
    });

    it("nav links use consistent hrefs", () => {
      seedHousehold();
      renderRoute("/household/h-nav/planner");
      const nav = screen.getByRole("navigation");
      const links = nav.querySelectorAll("a");
      const hrefs = Array.from(links).map((a) => a.getAttribute("href"));
      expect(hrefs).toContain("/household/h-nav/home");
      expect(hrefs).toContain("/household/h-nav/weekly");
      expect(hrefs).toContain("/household/h-nav/planner");
      expect(hrefs).toContain("/household/h-nav/grocery");
      expect(hrefs).toContain("/household/h-nav/rescue");
      expect(hrefs).toContain("/household/h-nav/history");
      expect(hrefs).toContain("/household/h-nav");
      expect(hrefs).toContain("/");
    });
  });

  describe("Navigation from child screens returns to Home", () => {
    it("Weekly planner Home link navigates to Home page", async () => {
      seedHousehold();
      const user = userEvent.setup();
      renderRoute("/household/h-nav/weekly");
      const nav = screen.getByRole("navigation");
      await user.click(within(nav).getByText("Home"));
      expect(screen.getByText("What should we eat tonight?")).toBeInTheDocument();
    });

    it("Meal planner Home link navigates to Home page", async () => {
      seedHousehold();
      const user = userEvent.setup();
      renderRoute("/household/h-nav/planner");
      const nav = screen.getByRole("navigation");
      await user.click(within(nav).getByText("Home"));
      expect(screen.getByText("What should we eat tonight?")).toBeInTheDocument();
    });

    it("Grocery list Home link navigates to Home page", async () => {
      seedHousehold();
      const user = userEvent.setup();
      renderRoute("/household/h-nav/grocery");
      const nav = screen.getByRole("navigation");
      await user.click(within(nav).getByText("Home"));
      expect(screen.getByText("What should we eat tonight?")).toBeInTheDocument();
    });

    it("Rescue mode Home link navigates to Home page", async () => {
      seedHousehold();
      const user = userEvent.setup();
      renderRoute("/household/h-nav/rescue");
      const nav = screen.getByRole("navigation");
      await user.click(within(nav).getByText("Home"));
      expect(screen.getByText("What should we eat tonight?")).toBeInTheDocument();
    });
  });

  describe("MemberProfile default return goes to Home", () => {
    it("save without returnTo navigates to Home", async () => {
      seedHousehold();
      const user = userEvent.setup();
      renderRoute("/household/h-nav/member/m1");
      await user.click(screen.getByText("Save profile"));
      expect(screen.getByText("What should we eat tonight?")).toBeInTheDocument();
    });
  });

  describe("Consistent nav link order", () => {
    it("links appear in the same order on all pages", () => {
      seedHousehold();
      renderRoute("/household/h-nav/home");
      const homeNav = screen.getByRole("navigation");
      const homeOrder = Array.from(homeNav.querySelectorAll("a")).map((a) => a.textContent);

      cleanup();
      seedHousehold();
      renderRoute("/household/h-nav/planner");
      const plannerNav = screen.getByRole("navigation");
      const plannerOrder = Array.from(plannerNav.querySelectorAll("a")).map((a) => a.textContent);

      expect(homeOrder).toEqual(plannerOrder);
    });
  });

  describe("Nav uses shared styling system", () => {
    it("nav is rendered as a nav element with top-nav border-b styling", () => {
      seedHousehold();
      renderRoute("/household/h-nav/home");
      const nav = screen.getByRole("navigation");
      expect(nav.className).toContain("border-b");
      expect(nav.className).toContain("flex-wrap");
    });

    it("nav links use brand color and hover underline", () => {
      seedHousehold();
      renderRoute("/household/h-nav/home");
      const nav = screen.getByRole("navigation");
      const link = within(nav).getByText("Weekly planner");
      expect(link.className).toContain("text-brand");
      expect(link.className).toContain("hover:underline");
    });
  });
});
