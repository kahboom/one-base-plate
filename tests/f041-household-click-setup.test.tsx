import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import type { Household } from "../src/types";
import { saveHousehold } from "../src/storage";
import HouseholdList from "../src/pages/HouseholdList";
import HouseholdSetup from "../src/pages/HouseholdSetup";
import Home from "../src/pages/Home";

function seedHousehold(): Household {
  const household: Household = {
    id: "h-041",
    name: "Click Test Family",
    members: [
      {
        id: "m1",
        name: "Alex",
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

function renderApp(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<HouseholdList />} />
        <Route path="/household/new" element={<HouseholdSetup />} />
        <Route path="/household/:id" element={<HouseholdSetup />} />
        <Route path="/household/:householdId/home" element={<Home />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe("F041: Clicking a household navigates to Edit setup; remove Household setup from nav", () => {
  describe("HouseholdList click behavior", () => {
    it("clicking household name navigates to HouseholdSetup", async () => {
      seedHousehold();
      const user = userEvent.setup();
      renderApp("/");
      const link = screen.getByText("Click Test Family");
      expect(link.closest("a")).toHaveAttribute("href", "/household/h-041");
      await user.click(link);
      expect(screen.getByText("Edit Household")).toBeInTheDocument();
    });

    it("household name link points to /household/:id not /household/:id/home", () => {
      seedHousehold();
      renderApp("/");
      const link = screen.getByText("Click Test Family");
      const href = link.closest("a")?.getAttribute("href");
      expect(href).toBe("/household/h-041");
      expect(href).not.toContain("/home");
    });

    it("no redundant Setup button on household card", () => {
      seedHousehold();
      renderApp("/");
      expect(screen.queryByRole("button", { name: /setup/i })).not.toBeInTheDocument();
    });

    it("Delete button still present on household card", () => {
      seedHousehold();
      renderApp("/");
      expect(screen.getByRole("button", { name: /delete/i })).toBeInTheDocument();
    });
  });

  describe("Household setup removed from HouseholdNav", () => {
    it("nav does not contain Household setup link", () => {
      seedHousehold();
      renderApp("/household/h-041");
      const nav = screen.getByRole("navigation");
      expect(within(nav).queryByText("Household setup")).not.toBeInTheDocument();
    });

    it("Home link is still present in nav", () => {
      seedHousehold();
      renderApp("/household/h-041");
      const nav = screen.getByRole("navigation");
      expect(within(nav).getByText("Home")).toBeInTheDocument();
    });

    it("All households link is still present in nav", () => {
      seedHousehold();
      renderApp("/household/h-041");
      const nav = screen.getByRole("navigation");
      expect(within(nav).getByText("All households")).toBeInTheDocument();
    });
  });

  describe("Users can reach Home from within a household", () => {
    it("clicking Home in nav from HouseholdSetup navigates to Home page", async () => {
      seedHousehold();
      const user = userEvent.setup();
      renderApp("/household/h-041");
      const nav = screen.getByRole("navigation");
      await user.click(within(nav).getByText("Home"));
      expect(screen.getByText("What should we eat tonight?")).toBeInTheDocument();
    });
  });
});
